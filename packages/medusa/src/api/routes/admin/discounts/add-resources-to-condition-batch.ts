import DiscountConditionService from "../../../../services/discount-condition"
import { Request, Response } from "express"
import { EntityManager } from "typeorm"
import { DiscountService } from "../../../../services"
import {
  DiscountConditionInput,
  DiscountConditionMapTypeToProperty,
} from "../../../../types/discount"
import { IsArray, IsString } from "class-validator"
import { FindParams } from "../../../../types/common"
import { validator } from "../../../../utils/validator"
/**
 * @oas [post] /admin/discounts/{discount_id}/conditions/{condition_id}/batch
 * operationId: "PostDiscountsDiscountConditionsConditionBatch"
 * summary: "Add Batch Resources"
 * description: "Add a batch of resources to a discount condition. The type of resource depends on the type of discount condition. For example, if the discount condition's type is `products`,
 * the resources being added should be products."
 * x-authenticated: true
 * parameters:
 *   - (path) discount_id=* {string} The ID of the discount the condition belongs to.
 *   - (path) condition_id=* {string} The ID of the discount condition on which to add the item.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned discount.
 *   - (query) fields {string} Comma-separated fields that should be included in the returned discount.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/AdminPostDiscountsDiscountConditionsConditionBatchReq"
 * x-codegen:
 *   method: addConditionResourceBatch
 *   queryParams: AdminPostDiscountsDiscountConditionsConditionBatchParams
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.discounts.addConditionResourceBatch(discountId, conditionId, {
 *         resources: [{ id: itemId }]
 *       })
 *       .then(({ discount }) => {
 *         console.log(discount.id);
 *       })
 *   - lang: tsx
 *     label: Medusa React
 *     source: |
 *       import React from "react"
 *       import {
 *         useAdminAddDiscountConditionResourceBatch
 *       } from "medusa-react"
 *
 *       type Props = {
 *         discountId: string
 *         conditionId: string
 *       }
 *
 *       const DiscountCondition = ({
 *         discountId,
 *         conditionId
 *       }: Props) => {
 *         const addConditionResources = useAdminAddDiscountConditionResourceBatch(
 *           discountId,
 *           conditionId
 *         )
 *         // ...
 *
 *         const handleAdd = (itemId: string) => {
 *           addConditionResources.mutate({
 *             resources: [
 *               {
 *                 id: itemId
 *               }
 *             ]
 *           }, {
 *             onSuccess: ({ discount }) => {
 *               console.log(discount.id)
 *             }
 *           })
 *         }
 *
 *         // ...
 *       }
 *
 *       export default DiscountCondition
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X POST '{backend_url}/admin/discounts/{id}/conditions/{condition_id}/batch' \
 *       -H 'x-medusa-access-token: {api_token}' \
 *       -H 'Content-Type: application/json' \
 *       --data-raw '{
 *           "resources": [{ "id": "item_id" }]
 *       }'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * tags:
 *   - Discounts
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminDiscountsRes"
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
export default async (req: Request, res: Response) => {
  const { discount_id, condition_id } = req.params
  const validatedBody =
    req.validatedBody as AdminPostDiscountsDiscountConditionsConditionBatchReq
  const { store_id } = await validator(AdminPostDiscountConditionBatchQuery, req.query)
  const conditionService: DiscountConditionService = req.scope.resolve(
    "discountConditionService"
  )
  const manager: EntityManager = req.scope.resolve("manager")

  const condition = await conditionService.retrieve(condition_id, {
    select: ["id", "type", "discount_rule_id"],
  })

  const updateObj: DiscountConditionInput = {
    id: condition_id,
    rule_id: condition.discount_rule_id,
    [DiscountConditionMapTypeToProperty[condition.type]]:
      validatedBody.resources,
  }

  await manager.transaction(async (transactionManager) => {
    await conditionService
      .withTransaction(transactionManager)
      .upsertCondition(updateObj, false)
  })

  const discountService: DiscountService = req.scope.resolve("discountService")
  const discount = await discountService.retrieve(
    store_id,
    discount_id,
    req.retrieveConfig
  )

  res.status(200).json({ discount })
}

export class AdminPostDiscountConditionBatchQuery {
  @IsString()
  store_id: string
}
/**
 * @schema AdminPostDiscountsDiscountConditionsConditionBatchReq
 * type: object
 * description: "The details of the resources to add."
 * required:
 *   - resources
 * properties:
 *   resources:
 *     description: The resources to be added to the discount condition
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - id
 *       properties:
 *         id:
 *           description: The ID of the item
 *           type: string
 */
export class AdminPostDiscountsDiscountConditionsConditionBatchReq {
  @IsArray()
  resources: { id: string }[]
}

// eslint-disable-next-line max-len
export class AdminPostDiscountsDiscountConditionsConditionBatchParams extends FindParams { }
