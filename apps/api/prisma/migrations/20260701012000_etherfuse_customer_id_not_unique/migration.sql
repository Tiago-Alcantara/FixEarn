-- No modelo sandbox/org da Etherfuse, o customerId é o ID do org e é
-- compartilhado por todas as empresas. A unicidade é garantida por company_id.
DROP INDEX "etherfuse_customers_customer_id_key";
