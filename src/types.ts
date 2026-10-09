export type Variant = {id:number;label:string;sku:string;stock:number;price_override:number|null;is_active:boolean};
export type Category={id:number;slug:string;name:string;subtitle:string;icon:string;image_url:string;sort_order:number;is_active:boolean};
export type Product={id:number;category_id:number;category_slug:string;category_name:string;slug:string;name:string;brand:string;subtitle:string;description:string;image_url:string;gallery:string[];base_price:number;compare_at_price:number|null;badge:string;is_active:boolean;variants:Variant[]};
export type Banner={id:number;eyebrow:string;title:string;subtitle:string;image_url:string;button_text:string;button_link:string;kind:string;sort_order:number;is_active:boolean};
export type Me={id:string;telegram_id:string;username:string;first_name:string;photo_url:string;age_confirmed:boolean;age_verified:boolean;bonus_balance:number;role:'admin'|'customer'};
export type CartItem={id:string;quantity:number;variant_id:number;variant_label:string;stock:number;variant_active:boolean;product_id:number;slug:string;name:string;image_url:string;base_price:number;compare_at_price:number|null;badge:string;product_active:boolean;unit_price:number};
export type Cart={items:CartItem[];subtotal:number};
export type Order={id:string;number:string;status:string;customer_name:string;phone:string;city:string;shipping_details:string;delivery_method:string;payment_method:string;comment:string;subtotal:number;discount:number;bonus_used:number;total:number;bonus_awarded:number;created_at:string;items:{product_name:string;variant_label:string;quantity:number;unit_price:number;line_total?:number}[];telegram_id?:string;username?:string};
export type Coupon={id:number;code:string;kind:'percent'|'fixed';value:number;min_subtotal:number;max_uses:number|null;uses:number;is_active:boolean};
export const price=(p:number)=>new Intl.NumberFormat('uk-UA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(p/100)+' ₴';
export const statusTitle:Record<string,string>={pending:'Очікує',confirmed:'Підтверджено',shipped:'Відправлено',completed:'Виконано',received:'Отримано',cancelled:'Скасовано'};

export type Brand={id:number;slug:string;name:string;image_url:string;sort_order:number;is_active:boolean};
