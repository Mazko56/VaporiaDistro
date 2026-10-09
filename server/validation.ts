import {z} from 'zod';
import {normalizeUaPhone} from './uaPhone';
export const uaPhoneSchema=z.string().trim().max(32).transform((value,ctx)=>{
  const phone=normalizeUaPhone(value);
  if(!phone){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Вкажіть український номер телефону: +380671234567 або 0671234567'});return z.NEVER;}
  return phone;
});
