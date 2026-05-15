-- Replace the permissive profile update policy with one that prevents clients
-- from writing to payment-managed columns (subscription_status,
-- memory_book_unlocked, stripe_customer_id).  Those columns must only be
-- updated by the service-role webhook handler which bypasses RLS entirely.

drop policy if exists "users can update own profile" on profiles;

-- Clients may update any column EXCEPT the three protected ones.
-- The WITH CHECK expression re-asserts that the incoming NEW values for those
-- columns must equal the existing values already stored in the row, so any
-- attempt to change them is rejected by Postgres before the write lands.
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- protected columns must not be changed by the client
    and subscription_status = (select subscription_status from profiles where id = auth.uid())
    and memory_book_unlocked = (select memory_book_unlocked from profiles where id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from profiles where id = auth.uid())
  );
