import {authorize,authorizeAny} from "@/modules/rbac/domain/policy";
import type {Account} from "@/modules/users/domain/contracts";
import {corporateCardCommands,type CorporateCardCommand} from "../domain/contracts";
export interface CorporateCardRepository{execute(command:CorporateCardCommand,requestId:string):Promise<unknown>}
export async function executeCorporateCardCommand(account:Account|null,input:unknown,repository:CorporateCardRepository,requestId:string){const command=corporateCardCommands.parse(input);if(command.action.startsWith("expense."))authorizeAny(account,["EXPENSE_WRITE_SELF","EXPENSE_MANAGE"]);else authorize(account,command.action.startsWith("card.")||command.action==="card_assignment.save"?"CORPORATE_CARD_MANAGE":command.action==="settlement.queue"?"CARD_SETTLEMENT_SEND":"CARD_SETTLEMENT_MANAGE");return repository.execute(command,requestId)}
