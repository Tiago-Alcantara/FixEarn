-- CreateTable
CREATE TABLE "etherfuse_customers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "bank_account_id" TEXT,
    "wallet_id" TEXT,
    "kyc_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etherfuse_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ramp_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amount_fiat" TEXT,
    "amount_token" TEXT,
    "burn_transaction" TEXT,
    "deposit_clabe" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ramp_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etherfuse_customers_company_id_key" ON "etherfuse_customers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "etherfuse_customers_customer_id_key" ON "etherfuse_customers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "ramp_orders_order_id_key" ON "ramp_orders"("order_id");

-- CreateIndex
CREATE INDEX "ramp_orders_company_id_idx" ON "ramp_orders"("company_id");

-- AddForeignKey
ALTER TABLE "etherfuse_customers" ADD CONSTRAINT "etherfuse_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ramp_orders" ADD CONSTRAINT "ramp_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
