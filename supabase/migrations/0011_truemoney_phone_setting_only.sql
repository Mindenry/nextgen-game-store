-- Move the TrueMoney receiving phone out of the repository and into settings.
-- Existing installations may still hold a personal number: clear it so the shop
-- owner enters their own number in Admin → Payment Settings.

update system_settings
   set value = '""'::jsonb, updated_at = now()
 where key = 'truemoney.phone';

update payment_providers
   set config = jsonb_set(
         coalesce(config, '{}'::jsonb),
         '{instructions}',
         to_jsonb('ส่งซองอั่งเปา TrueMoney ตามเบอร์ที่ร้านตั้งค่าไว้ แล้ววางลิงก์ซองอั่งเปาในช่องด้านล่าง เจ้าหน้าที่จะ redeem และอนุมัติยอดให้'::text)
       ),
       updated_at = now()
 where id = 'truemoney_angpao';
