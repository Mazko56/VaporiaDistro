import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {normalizeUaPhone} from '../server/uaPhone.ts';
test('Ukrainian numbers normalized to E.164 consistently',()=>{
  for(const [input,expected] of [
    ['+380671234567','+380671234567'],
    ['0671234567','+380671234567'],
    ['380671234567','+380671234567'],
    ['+38 (067) 123-45-67','+380671234567'],
    ['+380 (67) 123-45-67','+380671234567']
  ])assert.equal(normalizeUaPhone(input),expected);
});
test('rejects foreign, short, long and invalid input',()=>{
  for(const input of ['123','+48123456789','+38067123456','+3806712345678','+380 abc123','+380 +671234567','+380671234567 ext 7',''])
    assert.equal(normalizeUaPhone(input),null,input);
});
