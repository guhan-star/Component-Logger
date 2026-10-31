import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Seeding realistic sample components & relationships...');

  // Manufacturers
  const espressif = await prisma.manufacturer.upsert({
    where: { name: 'Espressif Systems' },
    update: {},
    create: { name: 'Espressif Systems', website: 'https://www.espressif.com', country: 'China' },
  });

  const ti = await prisma.manufacturer.upsert({
    where: { name: 'Texas Instruments' },
    update: {},
    create: { name: 'Texas Instruments', website: 'https://www.ti.com', country: 'USA' },
  });

  const st = await prisma.manufacturer.upsert({
    where: { name: 'STMicroelectronics' },
    update: {},
    create: { name: 'STMicroelectronics', website: 'https://www.st.com', country: 'Switzerland' },
  });

  const bosch = await prisma.manufacturer.upsert({
    where: { name: 'Bosch Sensortec' },
    update: {},
    create: { name: 'Bosch Sensortec', website: 'https://www.bosch-sensortec.com', country: 'Germany' },
  });

  // Suppliers
  const robu = await prisma.supplier.upsert({
    where: { name: 'Robu.in' },
    update: {},
    create: { name: 'Robu.in', website: 'https://robu.in', contact: 'support@robu.in' },
  });

  const mouser = await prisma.supplier.upsert({
    where: { name: 'Mouser Electronics' },
    update: {},
    create: { name: 'Mouser Electronics', website: 'https://www.mouser.in', contact: 'orders@mouser.com' },
  });

  // People
  const rahul = await prisma.person.upsert({
    where: { id: 'person-rahul' },
    update: {},
    create: { id: 'person-rahul', name: 'Rahul Sharma', email: 'rahul.s@example.com', phone: '+91 9876543210', notes: 'Lab colleague' },
  });

  const priya = await prisma.person.upsert({
    where: { id: 'person-priya' },
    update: {},
    create: { id: 'person-priya', name: 'Priya Nair', email: 'priya.n@example.com', phone: '+91 9876543211', notes: 'Robotics team lead' },
  });

  // Tags
  const tagIot = await prisma.tag.upsert({
    where: { name: 'IoT' },
    update: {},
    create: { name: 'IoT', color: '#3b82f6' },
  });

  const tagSmd = await prisma.tag.upsert({
    where: { name: 'SMD' },
    update: {},
    create: { name: 'SMD', color: '#10b981' },
  });

  const tagDip = await prisma.tag.upsert({
    where: { name: 'Through-Hole' },
    update: {},
    create: { name: 'Through-Hole', color: '#8b5cf6' },
  });

  const tagHighPower = await prisma.tag.upsert({
    where: { name: 'Power' },
    update: {},
    create: { name: 'Power', color: '#ef4444' },
  });

  // Categories
  const devBoards = await prisma.category.findUnique({ where: { name: 'Dev Boards & Modules' } });
  const sensors = await prisma.category.findUnique({ where: { name: 'Sensors' } });
  const resistors = await prisma.category.findUnique({ where: { name: 'Resistors' } });
  const transistors = await prisma.category.findUnique({ where: { name: 'Transistors & MOSFETs' } });
  const displays = await prisma.category.findUnique({ where: { name: 'Displays' } });
  const power = await prisma.category.findUnique({ where: { name: 'Batteries & Power' } });

  // 1. ESP32 NodeMCU
  const esp32 = await prisma.component.create({
    data: {
      name: 'ESP32 NodeMCU Development Board (ESP-WROOM-32)',
      description: 'Dual-core 240MHz microcontroller with Wi-Fi and Bluetooth BLE 4.2',
      categoryId: devBoards?.id,
      subcategory: 'Microcontroller Boards',
      manufacturerId: espressif.id,
      supplierId: robu.id,
      mpn: 'ESP32-WROOM-32D',
      genericPartNumber: 'ESP32-DevKitC',
      quantityOwned: 6,
      quantityAvailable: 4,
      quantityReserved: 1,
      quantityInUse: 0,
      quantityLentOut: 1,
      quantityBorrowed: 0,
      condition: 'New',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Personal',
      unitCost: 320,
      currency: 'INR',
      storageLocation: 'Box A - Row 1',
      minimumStock: 2,
      notes: 'Standard 30-pin layout, CP2102 USB-to-UART',
      datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32d_esp32-wroom-32u_datasheet_en.pdf',
    },
  });

  // Link tags & specs
  await prisma.componentTag.create({ data: { componentId: esp32.id, tagId: tagIot.id } });
  await prisma.technicalSpec.createMany({
    data: [
      { componentId: esp32.id, fieldName: 'operating_voltage', textValue: '3.3V', numericValue: 3.3, unit: 'V' },
      { componentId: esp32.id, fieldName: 'clock_frequency', textValue: '240 MHz', numericValue: 240000000, unit: 'MHz' },
      { componentId: esp32.id, fieldName: 'flash_size', textValue: '4 MB', numericValue: 4, unit: 'MB' },
    ],
  });

  // 2. BMP280 Barometric Pressure & Temperature Sensor
  const bmp280 = await prisma.component.create({
    data: {
      name: 'BMP280 Barometric Pressure & Altitude Sensor Module',
      description: 'High-precision digital atmospheric pressure sensor, I2C/SPI interface',
      categoryId: sensors?.id,
      subcategory: 'Environmental',
      manufacturerId: bosch.id,
      supplierId: robu.id,
      mpn: 'BMP280-MOD',
      quantityOwned: 8,
      quantityAvailable: 7,
      quantityReserved: 1,
      quantityInUse: 0,
      quantityLentOut: 0,
      quantityBorrowed: 0,
      condition: 'New',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Personal',
      unitCost: 110,
      currency: 'INR',
      storageLocation: 'Box S - Slot 4',
      minimumStock: 3,
      datasheetUrl: 'https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf',
    },
  });
  await prisma.componentTag.create({ data: { componentId: bmp280.id, tagId: tagIot.id } });

  // 3. 0.96 inch I2C OLED Display (128x64)
  const oled = await prisma.component.create({
    data: {
      name: '0.96 inch I2C Monochrome OLED Display 128x64 (SSD1306)',
      description: 'Blue monochrome OLED display with 4-pin I2C interface',
      categoryId: displays?.id,
      subcategory: 'OLED',
      supplierId: robu.id,
      mpn: 'SSD1306-0.96-BLUE',
      quantityOwned: 3,
      quantityAvailable: 1,
      quantityReserved: 1,
      quantityInUse: 1,
      quantityLentOut: 0,
      quantityBorrowed: 0,
      condition: 'Good',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Personal',
      unitCost: 185,
      currency: 'INR',
      storageLocation: 'Box D - Slot 1',
      minimumStock: 2,
    },
  });

  // 4. 10k Ohm 1/4W Metal Film Resistors
  const resistor10k = await prisma.component.create({
    data: {
      name: '10k Ohm 1/4W 1% Metal Film Resistor',
      description: 'Standard pull-up / pull-down resistor pack',
      categoryId: resistors?.id,
      subcategory: 'Metal Film',
      supplierId: robu.id,
      mpn: 'MF-0.25W-10K-1%',
      quantityOwned: 150,
      quantityAvailable: 130,
      quantityReserved: 10,
      quantityInUse: 10,
      quantityLentOut: 0,
      quantityBorrowed: 0,
      condition: 'New',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Personal',
      unitCost: 0.8,
      currency: 'INR',
      storageLocation: 'Drawer R1 - 10k',
      minimumStock: 50,
    },
  });
  await prisma.componentTag.create({ data: { componentId: resistor10k.id, tagId: tagDip.id } });

  // 5. IRFZ44N Power MOSFET (Borrowed item!)
  const mosfet = await prisma.component.create({
    data: {
      name: 'IRFZ44N N-Channel Power MOSFET 55V 49A',
      description: 'TO-220 package power MOSFET for high current motor/load switching',
      categoryId: transistors?.id,
      subcategory: 'MOSFET',
      supplierId: mouser.id,
      mpn: 'IRFZ44NPBF',
      quantityOwned: 4,
      quantityAvailable: 4,
      quantityReserved: 0,
      quantityInUse: 0,
      quantityLentOut: 0,
      quantityBorrowed: 2,
      condition: 'Good',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Borrowed',
      unitCost: 45,
      currency: 'INR',
      storageLocation: 'Drawer T - Power',
      minimumStock: 2,
    },
  });
  await prisma.componentTag.create({ data: { componentId: mosfet.id, tagId: tagHighPower.id } });

  // 6. Low stock item: TP4056 1A Li-Ion Battery Charger Module
  const tp4056 = await prisma.component.create({
    data: {
      name: 'TP4056 1A Li-Ion Battery Charger with Protection (Type-C)',
      description: 'Micro/Type-C lithium battery charging board with battery protection IC',
      categoryId: power?.id,
      subcategory: 'Charger Modules',
      supplierId: robu.id,
      mpn: 'TP4056-TYPE-C',
      quantityOwned: 2,
      quantityAvailable: 1,
      quantityReserved: 0,
      quantityInUse: 1,
      quantityLentOut: 0,
      quantityBorrowed: 0,
      condition: 'New',
      unitOfMeasurement: 'pcs',
      ownershipType: 'Personal',
      unitCost: 35,
      currency: 'INR',
      storageLocation: 'Box P - Power Modules',
      minimumStock: 5, // Triggers low stock alert!
    },
  });

  // Borrow Record: Borrowed 2 IRFZ44N MOSFETs from Rahul
  await prisma.borrowRecord.create({
    data: {
      componentId: mosfet.id,
      borrowedFromId: rahul.id,
      quantity: 2,
      dateBorrowed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      expectedReturnDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // in 10 days
      status: 'Active',
      notes: 'Borrowed for high-current DC motor driver prototyping',
    },
  });

  // Lend Record: Lent 1 ESP32 to Priya
  await prisma.lendRecord.create({
    data: {
      componentId: esp32.id,
      lentToId: priya.id,
      quantity: 1,
      dateLent: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'Active',
      notes: 'Testing Bluetooth mesh sensor node',
    },
  });

  // Project: IoT Weather Station
  const project = await prisma.project.create({
    data: {
      name: 'Smart IoT Weather Station',
      description: 'Solar powered outdoor environmental station transmitting MQTT telemetry to Home Assistant',
      status: 'Active',
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      targetDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      notes: 'Target enclosure: 3D printed Stevenson screen',
    },
  });

  // Assign components to project
  await prisma.projectComponent.createMany({
    data: [
      {
        projectId: project.id,
        componentId: esp32.id,
        plannedQuantity: 1,
        reservedQuantity: 1,
        usedQuantity: 0,
        notes: 'Main controller board',
      },
      {
        projectId: project.id,
        componentId: bmp280.id,
        plannedQuantity: 1,
        reservedQuantity: 1,
        usedQuantity: 0,
        notes: 'Barometric sensor',
      },
      {
        projectId: project.id,
        componentId: oled.id,
        plannedQuantity: 1,
        reservedQuantity: 1,
        usedQuantity: 0,
        notes: 'Local display',
      },
      {
        projectId: project.id,
        componentId: resistor10k.id,
        plannedQuantity: 10,
        reservedQuantity: 10,
        usedQuantity: 0,
        notes: 'Pull-up resistors for I2C bus',
      },
    ],
  });

  // Purchase Items
  await prisma.purchaseItem.createMany({
    data: [
      {
        componentId: tp4056.id,
        componentName: 'TP4056 1A Li-Ion Battery Charger (Pack of 5)',
        quantity: 5,
        estimatedCost: 175,
        currency: 'INR',
        supplierId: robu.id,
        supplierUrl: 'https://robu.in/product/tp4056-type-c-1a-li-ion-battery-charging-module/',
        priority: 'High',
        status: 'Needed',
        notes: 'Inventory is critically low (only 1 available)',
      },
      {
        componentName: 'BME680 Environmental Gas & Air Quality Sensor',
        quantity: 2,
        estimatedCost: 950,
        currency: 'INR',
        supplierId: robu.id,
        priority: 'Normal',
        status: 'Needed',
        notes: 'For upgrade to IAQ monitoring in weather station project',
      },
    ],
  });

  // Inventory Transactions
  await prisma.inventoryTransaction.createMany({
    data: [
      {
        componentId: esp32.id,
        transactionType: 'INITIAL',
        quantity: 6,
        previousQty: 0,
        resultingQty: 6,
        notes: 'Initial stock intake from Robu.in',
      },
      {
        componentId: esp32.id,
        transactionType: 'LEND',
        quantity: 1,
        previousQty: 6,
        resultingQty: 5,
        relatedPersonId: priya.id,
        notes: 'Lent to Priya Nair',
      },
      {
        componentId: mosfet.id,
        transactionType: 'BORROW',
        quantity: 2,
        previousQty: 2,
        resultingQty: 4,
        relatedPersonId: rahul.id,
        notes: 'Borrowed 2 units from Rahul Sharma',
      },
      {
        componentId: bmp280.id,
        transactionType: 'RESERVE',
        quantity: 1,
        previousQty: 8,
        resultingQty: 7,
        relatedProjectId: project.id,
        notes: 'Reserved for Smart IoT Weather Station',
      },
    ],
  });

  console.log('✅ Realistic sample data seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Sample seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
