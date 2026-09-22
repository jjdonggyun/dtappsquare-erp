export type MasterDataValidationIssue={level:"ERROR"|"WARNING";file:string;row:number;column:string;message:string};
export type MasterDataValidationResult={total:number;valid:number;warnings:number;errors:number;issues:MasterDataValidationIssue[]};
export function validateMasterData(directory:string):Promise<MasterDataValidationResult>;
