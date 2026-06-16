import { PrismaClient, CompanyType, UserRole, VehicleType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const maruichi = await prisma.company.upsert({
    where: { id: 'maruichi-company' },
    update: {},
    create: {
      id: 'maruichi-company',
      name: 'Maruichi Souko Company',
      type: CompanyType.MARUICHI,
      address: 'Tokyo, Japan',
      email: 'contact@maruichi.jp',
      phone: '+81-3-1234-5678',
    },
  });

  const shinwa = await prisma.company.upsert({
    where: { id: 'shinwa-company' },
    update: {},
    create: {
      id: 'shinwa-company',
      name: 'Shinwa Company',
      type: CompanyType.SHINWA,
      address: 'Osaka, Japan',
      email: 'contact@shinwa.jp',
      phone: '+81-6-1234-5678',
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
    },
  });

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

  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      name: 'Taro Yamada',
      phone: '+81-90-1234-5678',
      licenseNo: 'DL-123456',
      companyId: shinwa.id,
      userId: driverUser.id,
    },
  });

  await prisma.vehicle.upsert({
    where: { plateNumber: '品川500あ12-34' },
    update: {},
    create: {
      plateNumber: '品川500あ12-34',
      vehicleType: VehicleType.MEDIUM_TRUCK,
      capacity: 4000,
      companyId: shinwa.id,
    },
  });

  await prisma.vehicle.upsert({
    where: { plateNumber: '大阪400い56-78' },
    update: {},
    create: {
      plateNumber: '大阪400い56-78',
      vehicleType: VehicleType.LARGE_TRUCK,
      capacity: 10000,
      companyId: subcontractor.id,
    },
  });

  const subDriverUser = await prisma.user.upsert({
    where: { email: 'driver@kansai-logistics.jp' },
    update: {},
    create: {
      email: 'driver@kansai-logistics.jp',
      passwordHash,
      name: 'Kenji Sato',
      role: UserRole.DRIVER,
      companyId: subcontractor.id,
    },
  });

  await prisma.driver.upsert({
    where: { userId: subDriverUser.id },
    update: {},
    create: {
      name: 'Kenji Sato',
      phone: '+81-90-9876-5432',
      licenseNo: 'DL-789012',
      companyId: subcontractor.id,
      userId: subDriverUser.id,
    },
  });

  console.log('Seed completed:', { maruichi, shinwa, subcontractor, driver });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
