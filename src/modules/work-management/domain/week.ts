export function mondayOf(date:string){const day=new Date(`${date}T00:00:00Z`);const dow=day.getUTCDay();day.setUTCDate(day.getUTCDate()-((dow+6)%7));return day.toISOString().slice(0,10)}
export function shiftDays(date:string,days:number){const day=new Date(`${date}T00:00:00Z`);day.setUTCDate(day.getUTCDate()+days);return day.toISOString().slice(0,10)}
