import { EntityManager } from "typeorm"
import UserService from "../../../../services/user"

/**
 * @oas [delete] /admin/users/{id}
 * operationId: "DeleteUsersUser"
 * summary: "Delete a User"
 * description: "Delete a User. Once deleted, the user will not be able to authenticate or perform admin functionalities."
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The ID of the User.
 * x-codegen:
 *   method: delete
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.users.delete(userId)
 *       .then(({ id, object, deleted }) => {
 *         console.log(id);
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X DELETE '{backend_url}/admin/users/{id}' \
 *       -H 'x-medusa-access-token: {api_token}'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * tags:
 *   - Users
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminDeleteUserRes"
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
  const { user_id } = req.params
  const {store_id} = req.query

  const userService: UserService = req.scope.resolve("userService")
  const manager: EntityManager = req.scope.resolve("manager")
  await manager.transaction(async (transactionManager) => {
    return await userService.withTransaction(transactionManager).delete(store_id,user_id)
  })

  res.status(200).send({
    id: user_id,
    object: "user",
    deleted: true,
  })
}
