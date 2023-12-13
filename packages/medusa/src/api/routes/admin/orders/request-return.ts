import { isDefined, MedusaError } from "@medusajs/utils"
import { Type } from "class-transformer"
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator"
import { EntityManager } from "typeorm"
import { Order, Return } from "../../../../models"
import {
  EventBusService,
  OrderService,
  ReturnService,
} from "../../../../services"
import { FindParams } from "../../../../types/common"
import { OrdersReturnItem } from "../../../../types/orders"
import { cleanResponseData } from "../../../../utils/clean-response-data"

/**
 * @oas [post] /admin/orders/{id}/return
 * operationId: "PostOrdersOrderReturns"
 * summary: "Request a Return"
 * description: "Request and create a Return for items in an order. If the return shipping method is specified, it will be automatically fulfilled."
 * x-authenticated: true
 * externalDocs:
 *   description: Return creation process
 *   url: https://docs.medusajs.com/modules/orders/returns#returns-process
 * parameters:
 *   - (path) id=* {string} The ID of the Order.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned order.
 *   - (query) fields {string} Comma-separated fields that should be included in the returned order.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/AdminPostOrdersOrderReturnsReq"
 * x-codegen:
 *   method: requestReturn
 *   params: AdminPostOrdersOrderReturnsParams
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.orders.requestReturn(orderId, {
 *         items: [
 *           {
 *             item_id,
 *             quantity: 1
 *           }
 *         ]
 *       })
 *       .then(({ order }) => {
 *         console.log(order.id);
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X POST '{backend_url}/admin/orders/{id}/return' \
 *       -H 'x-medusa-access-token: {api_token}' \
 *       -H 'Content-Type: application/json' \
 *       --data-raw '{
 *           "items": [
 *             {
 *               "item_id": "{item_id}",
 *               "quantity": 1
 *             }
 *           ]
 *       }'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * tags:
 *   - Orders
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminOrdersRes"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 */
export default async (req, res) => {
  const { id } = req.params
  const { store_id } = req.query

  const value = req.validatedBody as AdminPostOrdersOrderReturnsReq

  const idempotencyKeyService = req.scope.resolve("idempotencyKeyService")
  const manager: EntityManager = req.scope.resolve("manager")

  const headerKey = req.get("Idempotency-Key") || ""

  let idempotencyKey
  try {
    await manager.transaction(async (transactionManager) => {
      idempotencyKey = await idempotencyKeyService
        .withTransaction(transactionManager)
        .initializeRequest(headerKey, req.method, req.params, req.path)
    })
  } catch (error) {
    res.status(409).send("Failed to create idempotency key")
    return
  }

  res.setHeader("Access-Control-Expose-Headers", "Idempotency-Key")
  res.setHeader("Idempotency-Key", idempotencyKey.idempotency_key)

  try {
    const orderService: OrderService = req.scope.resolve("orderService")
    const inventoryServiceEnabled =
      !!req.scope.resolve("inventoryService") &&
      !!req.scope.resolve("stockLocationService")
    const returnService: ReturnService = req.scope.resolve("returnService")
    const eventBus: EventBusService = req.scope.resolve("eventBusService")

    let inProgress = true
    let err = false

    while (inProgress) {
      switch (idempotencyKey.recovery_point) {
        case "started": {
          await manager
            .transaction("SERIALIZABLE", async (transactionManager) => {
              idempotencyKey = await idempotencyKeyService
                .withTransaction(transactionManager)
                .workStage(idempotencyKey.idempotency_key, async (manager) => {
                  const returnObj: ReturnObj = {
                    order_id: id,
                    idempotency_key: idempotencyKey.idempotency_key,
                    items: value.items,
                  }
                  if (isDefined(value.location_id) && inventoryServiceEnabled) {
                    returnObj.location_id = value.location_id
                  }

                  if (value.return_shipping) {
                    returnObj.shipping_method = value.return_shipping
                  }

                  if (isDefined(value.refund) && value.refund < 0) {
                    returnObj.refund_amount = 0
                  } else {
                    if (value.refund && value.refund >= 0) {
                      returnObj.refund_amount = value.refund
                    }
                  }

                  let evaluatedNoNotification = value.no_notification

                  if (!isDefined(evaluatedNoNotification)) {
                    const order = await orderService
                      .withTransaction(manager)
                      .retrieve(store_id, id)

                    evaluatedNoNotification = order.no_notification
                  }

                  returnObj.no_notification = evaluatedNoNotification

                  const createdReturn = await returnService
                    .withTransaction(manager)
                    .create(store_id, returnObj)

                  if (value.return_shipping) {
                    await returnService
                      .withTransaction(manager)
                      .fulfill(store_id, createdReturn.id)
                  }

                  await eventBus
                    .withTransaction(manager)
                    .emit(OrderService.Events.RETURN_REQUESTED, {
                      id,
                      return_id: createdReturn.id,
                      no_notification: evaluatedNoNotification,
                    })

                  return {
                    recovery_point: "return_requested",
                  }
                })
            })
            .catch((e) => {
              inProgress = false
              err = e
            })
          break
        }

        case "return_requested": {
          await manager
            .transaction("SERIALIZABLE", async (transactionManager) => {
              idempotencyKey = await idempotencyKeyService
                .withTransaction(transactionManager)
                .workStage(idempotencyKey.idempotency_key, async (manager) => {
                  let order: Order | Return

                  /**
                   * If we are ready to receive immediately, we find the newly created return
                   * and register it as received.
                   */
                  if (value.receive_now) {
                    const returns = await returnService
                      .withTransaction(manager)
                      .list({
                        idempotency_key: idempotencyKey.idempotency_key,
                      })

                    if (!returns.length) {
                      throw new MedusaError(
                        MedusaError.Types.INVALID_DATA,
                        `Return not found`
                      )
                    }

                    const returnOrder = returns[0]

                    order = await returnService
                      .withTransaction(manager)
                      .receive(
                        store_id,
                        returnOrder.id,
                        value.items,
                        value.refund
                      )
                  }

                  order = await orderService
                    .withTransaction(manager)
                    .retrieveWithTotals(store_id, id, req.retrieveConfig, {
                      includes: req.includes,
                    })

                  return {
                    response_code: 200,
                    response_body: {
                      order: cleanResponseData(order, []),
                    },
                  }
                })
            })
            .catch((e) => {
              inProgress = false
              err = e
            })
          break
        }

        case "finished": {
          inProgress = false
          break
        }

        default:
          await manager.transaction(async (transactionManager) => {
            idempotencyKey = await idempotencyKeyService
              .withTransaction(transactionManager)
              .update(idempotencyKey.idempotency_key, {
                recovery_point: "finished",
                response_code: 500,
                response_body: { message: "Unknown recovery point" },
              })
          })
          break
      }
    }

    if (err) {
      throw err
    }

    res.status(idempotencyKey.response_code).json(idempotencyKey.response_body)
  } catch (err) {
    console.log(err)
    throw err
  }
}

type ReturnObj = {
  order_id: string
  idempotency_key?: string
  items?: OrdersReturnItem[]
  shipping_method?: ReturnShipping
  refund_amount?: number
  no_notification?: boolean
  location_id?: string
}

/**
 * @schema AdminPostOrdersOrderReturnsReq
 * type: object
 * required:
 *   - items
 * properties:
 *   items:
 *     description: The line items that will be returned.
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - item_id
 *         - quantity
 *       properties:
 *         item_id:
 *           description: The ID of the Line Item.
 *           type: string
 *         reason_id:
 *           description: The ID of the Return Reason to use.
 *           type: string
 *         note:
 *           description: An optional note with information about the Return.
 *           type: string
 *         quantity:
 *           description: The quantity of the Line Item.
 *           type: integer
 *   return_shipping:
 *     description: The Shipping Method to be used to handle the return shipment.
 *     type: object
 *     properties:
 *       option_id:
 *         type: string
 *         description: The ID of the Shipping Option to create the Shipping Method from.
 *       price:
 *         type: integer
 *         description: The price to charge for the Shipping Method.
 *   note:
 *     description: An optional note with information about the Return.
 *     type: string
 *   receive_now:
 *     description: A flag to indicate if the Return should be registerd as received immediately.
 *     type: boolean
 *     default: false
 *   no_notification:
 *     description: >-
 *       If set to `true`, no notification will be sent to the customer related to this Return.
 *     type: boolean
 *   refund:
 *     description: The amount to refund.
 *     type: integer
 *   location_id:
 *     description: "The ID of the location used for the return."
 *     type: string
 */
export class AdminPostOrdersOrderReturnsReq {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdersReturnItem)
  items: OrdersReturnItem[]

  @IsOptional()
  @ValidateNested()
  @Type(() => ReturnShipping)
  return_shipping?: ReturnShipping

  @IsString()
  @IsOptional()
  note?: string

  @IsBoolean()
  @IsOptional()
  receive_now?: boolean = false

  @IsBoolean()
  @IsOptional()
  no_notification?: boolean

  @IsInt()
  @IsOptional()
  refund?: number

  @IsOptional()
  @IsString()
  location_id?: string

  @IsString()
  store_id: string
}

/**
 * The return's shipping method details.
 */
class ReturnShipping {
  /**
   * The ID of the shipping option used for the return.
   */
  @IsString()
  @IsOptional()
  option_id?: string

  /**
   * The shipping method's price.
   */
  @IsInt()
  @IsOptional()
  price?: number
}

// eslint-disable-next-line prettier/prettier
export class AdminPostOrdersOrderReturnsParams extends FindParams { }
