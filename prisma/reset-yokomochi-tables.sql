-- Drop legacy / partial Yokomochi tables so prisma db push can recreate them.
DROP TABLE IF EXISTS "YokomochiDeliveryForm" CASCADE;
DROP TABLE IF EXISTS "DeliveryVerification" CASCADE;
DROP TABLE IF EXISTS "DriverTask" CASCADE;
DROP TABLE IF EXISTS "YokomochiSubcontractAssignment" CASCADE;
DROP TABLE IF EXISTS "DriverSchedule" CASCADE;
DROP TABLE IF EXISTS "InternalFleetAssignment" CASCADE;
DROP TABLE IF EXISTS "CarrierResponse" CASCADE;
DROP TABLE IF EXISTS "CarrierRequest" CASCADE;
DROP TABLE IF EXISTS "YokomochiTrip" CASCADE;
DROP TABLE IF EXISTS "LogisticsTrip" CASCADE;
DROP TABLE IF EXISTS "NegotiationHistory" CASCADE;
DROP TABLE IF EXISTS "FactoryResponse" CASCADE;
DROP TABLE IF EXISTS "FactoryRequest" CASCADE;
DROP TABLE IF EXISTS "YokomochiOrder" CASCADE;
