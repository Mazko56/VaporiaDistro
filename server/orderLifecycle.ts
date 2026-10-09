/** Customer-visible status "Отримано" is the only NEW status that awards bonuses.
 * Legacy completed rows are preserved as immutable terminal historical data. */
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'received' | 'completed' | 'cancelled';
const transitions:Record<OrderStatus,readonly OrderStatus[]> = {
  pending:['confirmed','cancelled'],
  confirmed:['shipped','received','cancelled'],
  shipped:['received','cancelled'],
  received:[],completed:[],cancelled:[]
};
export const canTransitionOrder=(oldStatus:OrderStatus,next:OrderStatus)=>transitions[oldStatus]?.includes(next)??false;
/** totalKop is after discounts and redeemed bonuses, expressed in kopecks.
 * Points are whole hryvnias, so fractional points are rounded DOWN. */
export const earnedBonusPoints=(totalKop:number,percent:number)=>
  Math.max(0,Math.floor(totalKop*Math.min(100,Math.max(0,percent))/10000));
export const shouldAwardOrder=(oldStatus:OrderStatus,newStatus:OrderStatus,alreadyAwarded:number)=>
  newStatus==='received' && canTransitionOrder(oldStatus,newStatus) && alreadyAwarded===0;
