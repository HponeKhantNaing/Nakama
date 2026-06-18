import { PrismaClient, CompanyType, UserRole, TruckType, TruckStatus, DriverStatus, LicenseType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TRUCK_SPECS } from '../lib/tms/truck-assignment';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const maruichi = await prisma.company.upsert({
    where: { id: 'maruichi-company' },
    update: { name: '20号物流センター', latitude: 35.6762, longitude: 139.6503 },
    create: {
      id: 'maruichi-company',
      name: '20号物流センター',
      type: CompanyType.MARUICHI,
      address: 'Tokyo, Japan',
      email: 'contact@maruichi.jp',
      phone: '+81-3-1234-5678',
      latitude: 35.6762,
      longitude: 139.6503,
    },
  });

  const shinwa = await prisma.company.upsert({
    where: { id: 'shinwa-company' },
    update: { name: '建会社（進和運輸）', latitude: 34.6937, longitude: 135.5023 },
    create: {
      id: 'shinwa-company',
      name: '建会社（進和運輸）',
      type: CompanyType.SHINWA,
      address: 'Osaka, Japan',
      email: 'contact@shinwa.jp',
      phone: '+81-6-1234-5678',
      latitude: 34.6937,
      longitude: 135.5023,
    },
  });

  const subcontractor = await prisma.company.upsert({
    where: { id: 'subcontractor-company' },
    update: {},
    create: {
      id: 'subcontractor-company',
      name: 'Kansai Logistics Co.',
      type: CompanyType.SUBCONTRACTOR,
      address: 'Kyoto, Japan',
      email: 'contact@kansai-logistics.jp',
      phone: '+81-75-1234-5678',
      latitude: 35.0116,
      longitude: 135.7681,
    },
  });

  await prisma.company.upsert({
    where: { id: 'subcontractor-osaka' },
    update: {},
    create: {
      id: 'subcontractor-osaka',
      name: '大阪協力運輸',
      type: CompanyType.SUBCONTRACTOR,
      address: 'Osaka, Japan',
      email: 'contact@osaka-logistics.jp',
      phone: '+81-6-9999-0000',
      latitude: 34.6937,
      longitude: 135.5023,
    },
  });

  const factory = await prisma.company.upsert({
    where: { id: 'keycoffee-factory' },
    update: {},
    create: {
      id: 'keycoffee-factory',
      name: 'キーコーヒー飲料工場',
      type: CompanyType.FACTORY,
      address: '静岡県',
      email: 'factory@keycoffee.jp',
      phone: '+81-54-123-4567',
      latitude: 34.9756,
      longitude: 138.3827,
    },
  });

  await prisma.warehouse.upsert({
    where: { id: 'maruichi-tokyo-wh' },
    update: {},
    create: {
      id: 'maruichi-tokyo-wh',
      companyId: maruichi.id,
      name: 'Tokyo Main Warehouse',
      address: '1-1 Maruichi, Tokyo',
      latitude: 35.6762,
      longitude: 139.6503,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: 'customer-nagoya-01' },
    update: {},
    create: {
      id: 'customer-nagoya-01',
      name: 'Nagoya Trading Co.',
      address: 'Nagoya, Aichi',
      latitude: 35.1815,
      longitude: 136.9066,
      phone: '+81-52-123-4567',
    },
  });

  const products = [
    { sku: 'ELEC-001', name: 'Electronics Box', unitWeight: 5, unitVolume: 0.02, category: 'Electronics' },
    { sku: 'FOOD-001', name: 'Food Crate', unitWeight: 10, unitVolume: 0.05, category: 'Food', temperatureControlled: true },
    { sku: 'PART-001', name: 'Auto Parts Pallet', unitWeight: 25, unitVolume: 0.15, category: 'Industrial', fragile: true },
    { sku: 'BOX-001', name: 'Standard Carton', unitWeight: 2, unitVolume: 0.01, category: 'General' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  for (const spec of TRUCK_SPECS) {
    const truckNum = `SHINWA-${spec.type}`;
    await prisma.truck.upsert({
      where: { truckNumber: truckNum },
      update: {
        truckNo: truckNum,
        maxBoxes: spec.maxBoxes,
        capacityWeightKg: spec.capacityWeightKg,
        capacityVolumeM3: spec.capacityVolumeM3,
      },
      create: {
        truckNumber: truckNum,
        truckNo: truckNum,
        truckType: spec.type,
        plateNumber: `品川500${spec.type.slice(0, 3)}`,
        capacityWeightKg: spec.capacityWeightKg,
        capacityVolumeM3: spec.capacityVolumeM3,
        maxBoxes: spec.maxBoxes,
        maxPallet: Math.floor(spec.maxBoxes / 4),
        status: TruckStatus.AVAILABLE,
        companyId: shinwa.id,
      },
    });
  }

  for (let i = 1; i <= 3; i++) {
    const truckNum = `SHINWA-SMALL-${i}`;
    await prisma.truck.upsert({
      where: { truckNumber: truckNum },
      update: {},
      create: {
        truckNumber: truckNum,
        truckNo: truckNum,
        truckType: TruckType.SMALL,
        plateNumber: `品川501あ${i}`,
        capacityWeightKg: 2500,
        capacityVolumeM3: 8,
        maxBoxes: 24,
        maxPallet: 6,
        status: TruckStatus.AVAILABLE,
        companyId: shinwa.id,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'staff@maruichi.jp' },
    update: {},
    create: {
      email: 'staff@maruichi.jp',
      passwordHash,
      name: 'Maruichi Staff',
      role: UserRole.MARUICHI_STAFF,
      companyId: maruichi.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@shinwa.jp' },
    update: {},
    create: {
      email: 'staff@shinwa.jp',
      passwordHash,
      name: 'Shinwa Staff',
      role: UserRole.SHINWA_STAFF,
      companyId: shinwa.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@kansai-logistics.jp' },
    update: {},
    create: {
      email: 'staff@kansai-logistics.jp',
      passwordHash,
      name: 'Subcontractor Staff',
      role: UserRole.SUBCONTRACTOR_STAFF,
      companyId: subcontractor.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@keycoffee.jp' },
    update: {},
    create: {
      email: 'staff@keycoffee.jp',
      passwordHash,
      name: 'Factory Staff',
      role: UserRole.FACTORY_STAFF,
      companyId: factory.id,
    },
  });

  // Internal fleet — 10t trucks at 20号物流センター (16 pallets/trip)
  for (const [i, label] of [['A', '小野'], ['B', '浅川']] as const) {
    const truckNum = `WH-10T-${i}`;
    await prisma.truck.upsert({
      where: { truckNumber: truckNum },
      update: { maxPallet: 16, maxBoxes: 96, companyId: maruichi.id },
      create: {
        truckNumber: truckNum,
        truckNo: truckNum,
        truckType: TruckType.TEN_TON,
        plateNumber: `名古屋500あ${i}`,
        capacityWeightKg: 10000,
        capacityVolumeM3: 40,
        maxBoxes: 96,
        maxPallet: 16,
        status: TruckStatus.AVAILABLE,
        companyId: maruichi.id,
      },
    });
    await prisma.driver.upsert({
      where: { id: `maruichi-driver-${i}` },
      update: { name: label, companyId: maruichi.id },
      create: {
        id: `maruichi-driver-${i}`,
        name: label,
        phone: `+81-90-3000-000${i}`,
        licenseNo: `DL-MR-${i}`,
        licenseType: LicenseType.LARGE,
        companyId: maruichi.id,
        status: DriverStatus.AVAILABLE,
        isAvailable: true,
      },
    });
  }

  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@shinwa.jp' },
    update: {},
    create: {
      email: 'driver@shinwa.jp',
      passwordHash,
      name: 'Taro Yamada',
      role: UserRole.DRIVER,
      companyId: shinwa.id,
    },
  });

  const driver2User = await prisma.user.upsert({
    where: { email: 'driver2@shinwa.jp' },
    update: {},
    create: {
      email: 'driver2@shinwa.jp',
      passwordHash,
      name: 'Ken Suzuki',
      role: UserRole.DRIVER,
      companyId: shinwa.id,
    },
  });

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {
      status: DriverStatus.AVAILABLE,
      licenseType: LicenseType.LARGE,
      currentLat: 35.5,
      currentLng: 137.0,
    },
    create: {
      name: 'Taro Yamada',
      phone: '+81-90-1234-5678',
      licenseNo: 'DL-123456',
      licenseType: LicenseType.LARGE,
      companyId: shinwa.id,
      userId: driverUser.id,
      status: DriverStatus.AVAILABLE,
      currentLat: 35.5,
      currentLng: 137.0,
    },
  });

  // Extra demo drivers for multi-truck allocation.
  const demoDrivers = [
    { id: 'shinwa-driver-02', name: 'Ken Suzuki', phone: '+81-90-1111-0002', companyId: shinwa.id, userId: driver2User.id },
    { id: 'shinwa-driver-03', name: 'Yuki Sato', phone: '+81-90-1111-0003', companyId: shinwa.id, userId: null as string | null },
    { id: 'shinwa-driver-04', name: 'Hiro Tanaka', phone: '+81-90-1111-0004', companyId: shinwa.id, userId: null as string | null },
    { id: 'sub-driver-01', name: 'Sub Driver A', phone: '+81-90-2222-0001', companyId: subcontractor.id, userId: null as string | null },
    { id: 'sub-driver-02', name: 'Sub Driver B', phone: '+81-90-2222-0002', companyId: subcontractor.id, userId: null as string | null },
  ];

  for (const d of demoDrivers) {
    await prisma.driver.upsert({
      where: { id: d.id },
      update: {
        name: d.name,
        phone: d.phone,
        isAvailable: true,
        status: DriverStatus.AVAILABLE,
        ...(d.userId ? { userId: d.userId } : {}),
      },
      create: {
        id: d.id,
        name: d.name,
        phone: d.phone,
        licenseNo: null,
        licenseType: LicenseType.STANDARD,
        companyId: d.companyId,
        status: DriverStatus.AVAILABLE,
        isAvailable: true,
        ...(d.userId ? { userId: d.userId } : {}),
      },
    });
  }

  console.log('Enterprise TMS seed completed:', { maruichi, shinwa, factory, customer });
  console.log('Demo logins (password: password123):');
  console.log('  Warehouse: staff@maruichi.jp');
  console.log('  Factory: staff@keycoffee.jp');
  console.log('  Carrier: staff@shinwa.jp');
  console.log('  Driver 1: driver@shinwa.jp (Taro Yamada)');
  console.log('  Driver 2: driver2@shinwa.jp (Ken Suzuki)');
  console.log('  Internal drivers: 小野, 浅川 (maruichi fleet)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
