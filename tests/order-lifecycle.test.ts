import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {canTransitionOrder,earnedBonusPoints,shouldAwardOrder} from '../server/orderLifecycle';
test('only received after confirmation/shipment earns',()=>{
  assert.equal(shouldAwardOrder('pending','confirmed',0),false);
  assert.equal(shouldAwardOrder('confirmed','shipped',0),false);
  assert.equal(shouldAwardOrder('confirmed','received',0),true);
  assert.equal(shouldAwardOrder('shipped','received',0),true);
  assert.equal(shouldAwardOrder('received','received',0),false);
  assert.equal(shouldAwardOrder('completed','received',0),false);
  assert.equal(shouldAwardOrder('confirmed','received',5),false);
});
test('terminal states cannot be reopened or re-awarded',()=>{
  for(const status of ['received','completed','cancelled'] as const){
    assert.equal(canTransitionOrder(status,'received'),false);
    assert.equal(canTransitionOrder(status,'confirmed'),false);
  }
});
test('whole-hryvnia 5 percent points are calculated from paid total',()=>{
  assert.equal(earnedBonusPoints(200000,5),100);
  assert.equal(earnedBonusPoints(35000,5),17);
  assert.equal(earnedBonusPoints(100000,5),50);
  assert.equal(earnedBonusPoints(0,5),0);
});
