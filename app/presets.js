// Built-in presets, quick-add item catalog and note snippets. Edit freely for your shop.
// Catalog prices are 0 on purpose. The app remembers the price you type for each item, so enter it once.
// Blanks (__ / ______) are left for you to fill in, then use "Save as my preset".

const R = (desc, qty = 1, price = 0) => ({ desc, qty, price });

// ---------- quick-add item catalog (category -> items) ----------
export const catalog = {
  'Labor & service': [
    'Diagnostic / bench test', 'Labor', 'Labor (Discounted)', 'Labor - flat rate', 'Rush service',
    'Firmware update', 'IMU calibration', 'Compass calibration', 'Gimbal calibration', 'Vision sensor calibration',
    'Controller pairing / linking', 'Test flight / hover test', 'Data recovery / SD card', 'Cleaning / inspection',
  ],
  'Drone parts': [
    'Motor', 'ESC / power board', 'Arm', 'Landing gear', 'Shell / top cover', 'Bottom shell',
    'Gimbal ribbon / flex cable', 'Gimbal motor', 'Gimbal dampers (set)', 'Camera module', 'Slip ring',
    'Locking pins', 'Propellers (set)', 'Prop guards', 'GPS module', 'Antenna', 'Vision sensor', 'Flight battery',
    'Battery charger', 'Controller sticks', 'Controller repair',
  ],
  'Phone & device': [
    'Screen assembly', 'Battery', 'Charging port', 'Back glass', 'Rear camera', 'Front camera', 'Speaker',
    'Adhesive / seal kit', 'Screen protector', 'Case',
  ],
  'Shipping & fees': [
    'UPS Ground Return Shipping', 'UPS 3 Day Return Shipping', 'UPS 2nd Day Air Return Shipping', 'USPS Priority Return Shipping',
    'Packaging / box', 'Shipping insurance', 'Shop supplies', 'Disposal / recycling', 'Deposit applied',
  ],
};

// ---------- note snippets (Insert note dropdown) ----------
export const snippets = {
  'Warranty & policy': [
    'Warranty: 30 days on parts and labor.',
    'Warranty: 90 days on parts and labor.',
    'Crash damage is not covered.',
    'Liquid damage voids the warranty.',
    'Devices not picked up within 30 days may be recycled.',
    'We are not responsible for lost data. Please back up first.',
    '**This is an estimate, not a bill.** Valid for 14 days.',
  ],
  'Flight & care': [
    "Don't forget to calibrate your drone! Always fly safely, ENJOY!",
    'Calibrate the compass and IMU before your first flight.',
    'Hover low for a minute before flying far.',
    'Store batteries at storage charge (about 3.8 V per cell).',
    'Check that props are tight and undamaged before every flight.',
    'Set your Return-to-Home altitude above nearby trees and buildings.',
  ],
  'Payment & pickup': [
    'Paid in full. Thank you!',
    'Balance due at pickup.',
    'Deposit received. Balance due when the repair is done.',
    'Return tracking #: ____________________',
    'Please bring this receipt when you pick up.',
  ],
  'Thank you': [
    '> Thank you for your business!',
    '> Fly safe!',
    '> Enjoyed our service? Please leave us a review!',
  ],
};

// ---------- presets: category -> group -> preset ----------
// Layout fields (optional): header full|name|bar|none, showDate, size auto|1|1.5|2|3|4 (inches), frame none|cut|box|round, textSize S|M|L|XL
const STICKY = { type: 'note', header: 'none', showDate: true, showTime: true, showCustomer: true, size: '2', frame: 'cut', textSize: 'L', showFooter: false };
const STICKY_BRANDED = { ...STICKY, header: 'bar' };
const HANDLING = { type: 'warning', header: 'bar', showDate: false, showTime: false, showCustomer: false, size: '3', frame: 'box', textSize: 'L', showFooter: false };
const BRANDED = { type: 'note', header: 'full', showDate: false, showTime: false, showCustomer: false, size: 'auto', frame: 'round', textSize: 'M', showFooter: false };
const BIN = { type: 'bins', header: 'none', showDate: false, showTime: false, showCustomer: false, size: '1', frame: 'cut', textSize: 'L' };
const W = (title, body, extra = {}) => ({ type: 'warning', title, body, ...extra });

const rawPresets = [
  // ===== Receipts =====
  { cat: 'Receipts', group: 'Drone repair', name: 'Drone repair', doc: { type: 'receipt', title: 'DRONE REPAIR', items: [R('Diagnostic / bench test'), R('Parts'), R('Labor')], body: 'Warranty: 30 days on parts and labor.\nCrash damage is not covered.\n\nDon\'t forget to calibrate your drone! Always fly safely, ENJOY!' } },
  { cat: 'Receipts', group: 'Drone repair', name: 'Gimbal / camera repair', doc: { type: 'receipt', title: 'GIMBAL REPAIR', items: [R('Gimbal ribbon / flex cable'), R('Gimbal motor'), R('Labor'), R('Gimbal calibration')], body: 'Warranty: 30 days on parts and labor.' } },
  { cat: 'Receipts', group: 'Drone repair', name: 'Motor replacement', doc: { type: 'receipt', title: 'MOTOR REPLACEMENT', items: [R('Motor'), R('Labor'), R('Test flight / hover test')], body: '' } },
  { cat: 'Receipts', group: 'Drone repair', name: 'Arm / frame / shell', doc: { type: 'receipt', title: 'FRAME REPAIR', items: [R('Arm'), R('Shell / top cover'), R('Labor')], body: '' } },
  { cat: 'Receipts', group: 'Drone repair', name: 'Firmware & calibration', doc: { type: 'receipt', title: 'SERVICE', items: [R('Firmware update'), R('IMU calibration'), R('Compass calibration'), R('Controller pairing / linking')], body: '' } },
  { cat: 'Receipts', group: 'Drone repair', name: 'Mail-in repair (with return shipping)', doc: { type: 'receipt', title: 'MAIL-IN REPAIR', items: [R('Diagnostic / bench test'), R('Parts'), R('Labor'), R('UPS Ground Return Shipping')], body: 'Return tracking #: ____________________' } },
  { cat: 'Receipts', group: 'Phone & device', name: 'Screen replacement', doc: { type: 'receipt', title: 'SCREEN REPLACEMENT', items: [R('Screen assembly'), R('Labor')], body: 'Warranty: 90 days on the screen.\nNo warranty on new cracks or liquid damage.' } },
  { cat: 'Receipts', group: 'Phone & device', name: 'Battery / charging port', doc: { type: 'receipt', title: 'DEVICE REPAIR', items: [R('Battery'), R('Charging port'), R('Labor')], body: '' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Blank receipt', doc: { type: 'receipt', title: 'RECEIPT', items: [R('')], body: '' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Parts / accessories sale', doc: { type: 'receipt', title: 'SALE', items: [R('Propellers (set)'), R('Prop guards')], body: '' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Battery sale', doc: { type: 'receipt', title: 'BATTERY', items: [R('Flight battery')], body: 'Store batteries at storage charge (about 3.8 V per cell).' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Diagnostic fee', doc: { type: 'receipt', title: 'DIAGNOSTIC', items: [R('Diagnostic / bench test')], body: 'Diagnostic fee applies toward the repair if approved.' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Deposit', doc: { type: 'receipt', title: 'DEPOSIT RECEIVED', items: [R('Deposit toward repair / parts')], body: 'Balance due when the repair is done.' } },
  { cat: 'Receipts', group: 'Sales & payments', name: 'Estimate / quote', doc: { type: 'receipt', title: 'ESTIMATE', items: [R('Parts'), R('Labor')], body: '**This is an estimate, not a bill.**\nValid for 14 days. Price may change if more damage is found.' } },

  // ===== Sticky notes (2" cut-out squares) =====
  ...[
    ['Waiting on parts', '# WAITING ON PARTS\n\nOrdered: ________\nETA: ________'],
    ['Ready for pickup', '# READY FOR PICKUP\n\n> Tested and done'],
    ['Call customer', '# CALL CUSTOMER\n\nAbout: ______________'],
    ['Needs quote', '# NEEDS QUOTE\n\n> Do not start work'],
    ['Approved - start work', '# APPROVED\n\n> Start work\nLimit: $________'],
    ['On the bench', '# ON THE BENCH\n\nTech: ________'],
    ['Testing in progress', '# TESTING\n\n> Do not move'],
    ['Charging - do not unplug', '# CHARGING\n\n> Do not unplug'],
    ['Do not touch', '!! DO NOT TOUCH\n\n> Work in progress'],
    ['RUSH', '!! RUSH\n\nDue: ________'],
    ['Paid', '# PAID\n\n> In full'],
    ['Ship today', '# SHIP TODAY\n\nCarrier: ________'],
  ].map(([name, body]) => ({ cat: 'Sticky notes', group: 'Shop status', name, doc: { ...STICKY, title: '', body } })),
  ...[
    ['Blank sticky (write on it)', '\n\n\n'],
    ['To-do sticky', '## TO DO\n[ ] \n[ ] \n[ ] \n[ ] '],
    ['Order parts', '## ORDER PARTS\n- \n- \n- '],
    ['Follow up', '# FOLLOW UP\n\nWho: ________\nWhen: ________'],
    ['Reminder', '# REMINDER\n\n'],
  ].map(([name, body]) => ({ cat: 'Sticky notes', group: 'Reminders', name, doc: { ...STICKY, title: '', body } })),
  ...[
    ['Thank you (branded)', '# THANK YOU!\n\n> We appreciate your business'],
    ['Fly safe (branded)', '# FLY SAFE!\n\n> Calibrate before your first flight'],
    ['Serviced (branded)', '# SERVICED\n\nDate: ________\nTech: ________'],
  ].map(([name, body]) => ({ cat: 'Sticky notes', group: 'Branded', name, doc: { ...STICKY_BRANDED, title: '', body } })),

  // ===== Customer notes =====
  { cat: 'Customer notes', group: 'Status', name: 'Ready for pickup', doc: { type: 'note', title: 'READY FOR PICKUP', body: 'Your device is repaired and tested.\n\nPlease bring this ticket when you pick it up.' } },
  { cat: 'Customer notes', group: 'Status', name: 'Waiting on parts', doc: { type: 'note', title: 'WAITING ON PARTS', body: 'We ordered the parts for your repair.\nExpected arrival: ____________\n\nWe will contact you when it is ready.' } },
  { cat: 'Customer notes', group: 'Status', name: 'Repair approved', doc: { type: 'note', title: 'REPAIR APPROVED', body: 'Work approved by customer.\nApproved amount: $________\nDate: ____________', showFooter: false } },
  { cat: 'Customer notes', group: 'Status', name: 'No fault found', doc: { type: 'note', title: 'NO FAULT FOUND', body: 'We tested your device and could not reproduce the problem.\n\n## Tests done\n- \n- \n\nIf it happens again, note when and how.' } },
  { cat: 'Customer notes', group: 'Status', name: 'Not repairable', doc: { type: 'note', title: 'NOT REPAIRABLE', body: 'We could not repair this device.\nReason: ______________________\n\n## Options\n- Return as-is\n- Recycle at no charge\n- Replacement quote' } },
  { cat: 'Customer notes', group: 'Aftercare', name: 'After drone repair', doc: { type: 'note', title: 'BEFORE YOUR NEXT FLIGHT', body: '- Update the app and firmware if prompted\n- Calibrate the compass away from metal and cars\n- Calibrate the IMU on a level surface\n- Check props are tight and undamaged\n- Hover low for a minute before flying far\n- Confirm Return-to-Home altitude is set\n\n> Always fly safely, ENJOY!' } },
  { cat: 'Customer notes', group: 'Aftercare', name: 'Firmware updated', doc: { type: 'note', title: 'FIRMWARE UPDATED', body: 'Aircraft firmware: ____________\nController firmware: ____________\n\nYou may need to re-link the controller and re-download maps.' } },
  { cat: 'Customer notes', group: 'Aftercare', name: 'Battery care', doc: { type: 'note', title: 'BATTERY CARE', body: '- Store at storage charge (about 3.8 V per cell)\n- Do not leave fully charged for days\n- Charge at room temperature\n- Stop using a pack that swells\n- Recycle old packs at a battery drop-off' } },
  { cat: 'Customer notes', group: 'Aftercare', name: 'After screen repair', doc: { type: 'note', title: 'SCREEN CARE', body: '- Use a case and screen protector\n- Avoid pressure on the screen for 24 hours\n- Report touch or display issues right away' } },
  { cat: 'Customer notes', group: 'Policies', name: 'Back up your data', doc: { type: 'note', title: 'BACK UP YOUR DATA', body: 'Please back up photos, videos and flight logs before repairs.\nWe are not responsible for lost data.', showFooter: false } },
  { cat: 'Customer notes', group: 'Policies', name: 'Warranty terms', doc: { type: 'note', title: 'WARRANTY', body: 'Parts and labor: **30 days** from pickup.\n\n## Not covered\n- Crash or impact damage\n- Liquid damage\n- Repairs by others after ours\n\n> Keep this slip with your receipt' } },
  { cat: 'Customer notes', group: 'Policies', name: 'Pickup policy', doc: { type: 'note', title: 'PICKUP POLICY', body: 'Devices not picked up within **30 days** of the ready notice may be recycled or sold to cover costs.' } },
  { cat: 'Customer notes', group: 'Policies', name: 'Thank you', doc: { type: 'note', title: 'THANK YOU!', body: '> We appreciate your business.\n> Fly safe!\n\n> Enjoyed our service? Please leave us a review!' } },

  // ===== Warnings =====
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Calibrate before flying', doc: W('CALIBRATE BEFORE FLYING', '**Compass and IMU calibration required before the first flight.**\n\n- Outdoors, away from metal, cars and rebar\n- IMU on a flat, level surface\n- Follow the prompts in the app\n- Hover low and check stability first') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Compass calibration', doc: W('COMPASS CALIBRATION', 'Calibrate the compass before flying.\n\n- Away from metal, cars and power lines\n- Remove phones and keys from your pockets\n- Rotate as shown in the app') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'IMU calibration', doc: W('IMU CALIBRATION', 'Calibrate the IMU before flying.\n\n- Aircraft cool, on a flat level surface\n- Do not move it during calibration') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Gimbal calibration', doc: W('GIMBAL CALIBRATION', 'Run gimbal auto-calibration before use.\nPlace the aircraft level and keep it still.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Test hover first', doc: W('TEST HOVER FIRST', 'After a repair, hover low for **2 minutes** before flying far.\nLand right away if it drifts or makes noise.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Do not fly', doc: W('DO NOT FLY', 'Repair is not complete.\nReason: ______________________\n\nTech: ________  Date: ________') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Props removed', doc: W('PROPS REMOVED', 'Propellers removed for bench testing.\nInstall the correct props before flight.\nCheck direction markings (A / B).') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Check prop direction', doc: W('CHECK PROP DIRECTION', 'Match each prop to its motor marking.\nWrong props = instant flip on takeoff.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Remove gimbal clamp', doc: W('REMOVE GIMBAL CLAMP', '**Remove the gimbal clamp / cover before powering on.**\nPowering on with it installed can damage the gimbal motors.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Firmware update needed', doc: W('UPDATE FIRMWARE', 'Update aircraft, controller and battery firmware before flying.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'Set Return-to-Home', doc: W('SET RETURN-TO-HOME', 'Set the RTH altitude above trees and buildings.\nWait for the home point before takeoff.') },
  { cat: 'Warnings', group: 'Flight & calibration', name: 'FAA reminder', doc: W('FAA REMINDER', 'Drones 250 g and over must be registered with the FAA.\nRegistered drones need Remote ID.\nFollow local airspace rules.') },
  { cat: 'Warnings', group: 'Batteries', name: 'LiPo battery safety', doc: W('LIPO BATTERY', '- Never charge unattended\n- Charge on a fire-safe surface\n- Do not use swollen or damaged packs\n- Do not puncture, crush or short\n- Store around 3.8 V per cell\n- Recycle at a battery drop-off') },
  { cat: 'Warnings', group: 'Batteries', name: 'Swollen battery', doc: W('SWOLLEN BATTERY', '**DO NOT CHARGE OR FLY**\nThis battery is swollen and must be replaced.\nKeep away from heat. Recycle it safely.') },
  { cat: 'Warnings', group: 'Batteries', name: 'Do not charge unattended', doc: W('DO NOT CHARGE UNATTENDED', 'Stay nearby while charging.\nUnplug when full.') },
  { cat: 'Warnings', group: 'Batteries', name: 'Damaged battery - do not ship', doc: W('DAMAGED BATTERY', '**Do not ship.** Damaged lithium batteries need special handling.\nSet aside for recycling.') },
  { cat: 'Warnings', group: 'Batteries', name: 'Hot - let cool', doc: W('HOT - LET COOL', 'Let the battery cool before charging.\nWait at least 15 minutes after flight.') },
  { cat: 'Warnings', group: 'Device condition', name: 'Liquid damage', doc: W('LIQUID DAMAGE', 'Liquid damage found.\nOther parts may fail later.\nWarranty is limited on liquid-damaged devices.') },
  { cat: 'Warnings', group: 'Device condition', name: 'Crash damage', doc: W('CRASH DAMAGE', 'Hidden damage is possible after a crash.\nTest hover low before flying far.') },
  { cat: 'Warnings', group: 'Device condition', name: 'Previous repair by others', doc: W('PREVIOUS REPAIR', 'Signs of an earlier repair by someone else were found.\nWe cannot warranty parts we did not install.') },
  { cat: 'Warnings', group: 'Device condition', name: 'Cosmetic damage noted', doc: W('PRE-EXISTING DAMAGE', 'Noted at drop-off:\n- \n- \n\nCustomer initials: ______') },
  { cat: 'Warnings', group: 'Shop', name: 'Do not power on', doc: W('DO NOT POWER ON', 'Repair in progress.\nTech: ________') },
  { cat: 'Warnings', group: 'Shop', name: 'ESD sensitive', doc: W('ESD SENSITIVE', 'Use a grounded wrist strap.\nHandle boards by the edges.') },
  { cat: 'Warnings', group: 'Shop', name: 'Parts missing', doc: W('PARTS MISSING', 'Missing at drop-off:\n- \n- ') },

  // ===== Handling labels (3" boxed, branded bar) =====
  { cat: 'Handling labels', group: 'Package', name: 'Fragile - handle with care', doc: { ...HANDLING, title: 'FRAGILE', body: '# HANDLE WITH CARE\n> Sensitive electronics' } },
  { cat: 'Handling labels', group: 'Package', name: 'This side up', doc: { ...HANDLING, title: 'THIS SIDE UP', body: '# ↑ ↑ ↑\n> Keep upright' } },
  { cat: 'Handling labels', group: 'Package', name: 'Do not stack', doc: { ...HANDLING, title: 'DO NOT STACK', body: '> Nothing on top of this box' } },
  { cat: 'Handling labels', group: 'Package', name: 'Keep dry', doc: { ...HANDLING, title: 'KEEP DRY', body: '> Protect from rain and moisture' } },
  { cat: 'Handling labels', group: 'Package', name: 'Drone inside', doc: { ...HANDLING, title: 'DRONE INSIDE', body: '# HANDLE WITH CARE\n> Do not drop · Do not crush' } },
  { cat: 'Handling labels', group: 'Package', name: 'Open with care - no knives', doc: { ...HANDLING, title: 'OPEN WITH CARE', body: '> No knives or box cutters\n> Contents close to the top' } },
  { cat: 'Handling labels', group: 'Package', name: 'Lithium batteries - handle with care', doc: { ...HANDLING, title: 'LITHIUM BATTERIES', body: '# HANDLE WITH CARE\n> Damaged package: do not open\n### This label does not replace carrier-required battery markings.' } },
  { cat: 'Handling labels', group: 'Shop', name: 'Handle with care (small)', doc: { ...HANDLING, size: '1.5', title: 'HANDLE WITH CARE', body: '' } },
  { cat: 'Handling labels', group: 'Shop', name: 'Calibrated - do not bump', doc: { ...HANDLING, size: '2', title: 'CALIBRATED', body: '> Do not bump or move\n> Gimbal / sensors set' } },
  { cat: 'Handling labels', group: 'Shop', name: 'Sensitive electronics', doc: { ...HANDLING, size: '2', title: 'SENSITIVE ELECTRONICS', body: '> Handle by the edges · ESD safe only' } },

  // ===== Tags =====
  { cat: 'Tags', group: 'Repair', name: 'Repair ticket (customer copy)', doc: { type: 'tag', header: 'full', frame: 'none', title: 'REPAIR TICKET', body: 'Issue: \nAccessories: \nEstimate: \nDrop-off: ', showFooter: true } },
  { cat: 'Tags', group: 'Repair', name: 'Device tag (shop copy)', doc: { type: 'tag', title: 'DEVICE TAG', body: 'Issue: \nTech: \nStatus: ' } },
  { cat: 'Tags', group: 'Repair', name: 'Intake tag', doc: { type: 'tag', title: 'INTAKE', body: 'Serial: \nCondition: \nBatteries: \nAccessories: \nPasscode: ' } },
  { cat: 'Tags', group: 'Repair', name: 'Waiting for approval', doc: { type: 'tag', title: 'WAITING APPROVAL', body: 'Quote: \nCalled: \nAnswer: ' } },
  { cat: 'Tags', group: 'Repair', name: 'On hold', doc: { type: 'tag', title: 'ON HOLD', body: 'Reason: \nUntil: \nBy: ' } },
  { cat: 'Tags', group: 'Repair', name: 'Warranty return', doc: { type: 'tag', title: 'WARRANTY RETURN', body: 'Original repair: \nDate: \nComplaint: ' } },
  { cat: 'Tags', group: 'Quality', name: 'QC passed', doc: { type: 'tag', title: 'QC PASSED', body: 'Tech: \nDate: \nHover test: \nNotes: ' } },
  { cat: 'Tags', group: 'Quality', name: 'Test flown', doc: { type: 'tag', title: 'TEST FLOWN', body: 'Flight time: \nRTH tested: \nPilot: ' } },
  { cat: 'Tags', group: 'Quality', name: 'Battery tag', doc: { type: 'tag', title: 'BATTERY', body: 'Model: \nSerial: \nCycles: \nHealth: \nChecked: ' } },
  { cat: 'Tags', group: 'Inventory', name: 'Loaner', doc: { type: 'tag', title: 'LOANER', body: 'Out to: \nDate out: \nDue back: ' } },
  { cat: 'Tags', group: 'Inventory', name: 'For parts / not working', doc: { type: 'tag', title: 'FOR PARTS', body: 'Model: \nGood parts: \nBad parts: ' } },
  { cat: 'Tags', group: 'Inventory', name: 'Sold as-is', doc: { type: 'tag', title: 'SOLD AS-IS', body: 'Item: \nPrice: \nNo warranty.' } },
  { cat: 'Tags', group: 'Inventory', name: 'Customer accessories bag', doc: { type: 'tag', title: 'ACCESSORIES', body: 'Controller: \nBatteries: \nCharger: \nCase: \nOther: ' } },

  // ===== Branded labels =====
  { cat: 'Branded labels', group: 'Customer', name: 'Thank you card', doc: { ...BRANDED, title: '', body: '# THANK YOU!\n> We appreciate your business.\n\n> Enjoyed our service?\n> Please leave us a review!' } },
  { cat: 'Branded labels', group: 'Customer', name: 'Repaired by seal', doc: { ...BRANDED, size: '2', title: '', body: '# REPAIRED\n> Tested and inspected\n### Date: ________' } },
  { cat: 'Branded labels', group: 'Customer', name: 'Serviced by', doc: { ...BRANDED, size: '2', header: 'bar', showDate: true, title: '', body: '# SERVICED\nNext service: ________' } },
  { cat: 'Branded labels', group: 'Customer', name: 'Contact card', doc: { ...BRANDED, title: '', body: '> Drone & device repair\n\nPhone | ____________\nWeb | ____________\nEmail | ____________' } },
  { cat: 'Branded labels', group: 'Products', name: 'Price tag', doc: { ...BRANDED, size: '1.5', frame: 'cut', header: 'bar', title: '', body: '# $____\n> Item: ____________' } },
  { cat: 'Branded labels', group: 'Products', name: 'Product label', doc: { ...BRANDED, size: '2', frame: 'cut', header: 'bar', title: '', body: 'Item |\nSKU |\nCondition |\nPrice |' } },
  { cat: 'Branded labels', group: 'Products', name: 'Inspected / QC passed', doc: { ...BRANDED, size: '1.5', header: 'bar', showDate: true, title: '', body: '# QC PASSED' } },
  { cat: 'Branded labels', group: 'Shipping', name: 'Return address', doc: { ...BRANDED, size: '1.5', frame: 'cut', header: 'name', title: '', body: '______________________\n______________________\n______________________' } },
  { cat: 'Branded labels', group: 'Shipping', name: 'Packed by', doc: { ...BRANDED, size: '1.5', frame: 'cut', header: 'bar', showDate: true, title: '', body: 'Packed by | ________\nOrder # | ________' } },
  { cat: 'Branded labels', group: 'Assets', name: 'Property of (asset tag)', doc: { ...BRANDED, size: '1.5', frame: 'box', header: 'bar', title: '', body: '## PROPERTY OF\nAsset # | ________' } },

  // ===== Parts bins (1" cut-out labels, one per line) =====
  { cat: 'Parts bins', group: 'Single', name: 'One bin label', doc: { ...BIN, title: '', body: 'PROPELLERS | Mini 3 / Mini 4' } },
  { cat: 'Parts bins', group: 'Single', name: 'Bin label with brand bar', doc: { ...BIN, size: '1.5', header: 'bar', title: '', body: 'MOTORS | Mavic 3 series' } },
  { cat: 'Parts bins', group: 'Single', name: 'Big bin label (2")', doc: { ...BIN, size: '2', textSize: 'XL', title: '', body: 'SCREWS | M2 x 4 mm' } },
  { cat: 'Parts bins', group: 'Sets', name: 'Drone parts set', doc: { ...BIN, title: '', body: 'PROPELLERS\nMOTORS\nESC BOARDS\nARMS\nLANDING GEAR\nGIMBAL RIBBONS\nGIMBAL DAMPERS\nSHELLS\nGPS MODULES\nANTENNAS\nCAMERAS\nCONTROLLER PARTS' } },
  { cat: 'Parts bins', group: 'Sets', name: 'Screws & hardware', doc: { ...BIN, title: '', body: 'M1.6 SCREWS\nM2 SCREWS\nM2.5 SCREWS\nM3 SCREWS\nNUTS\nWASHERS\nSTANDOFFS\nRUBBER GROMMETS' } },
  { cat: 'Parts bins', group: 'Sets', name: 'Phone parts set', doc: { ...BIN, title: '', body: 'SCREENS\nBATTERIES\nCHARGING PORTS\nBACK GLASS\nCAMERAS\nSPEAKERS\nADHESIVES\nFLEX CABLES' } },
  { cat: 'Parts bins', group: 'Sets', name: 'Shop supplies set', doc: { ...BIN, title: '', body: 'SOLDER\nFLUX\nHEAT SHRINK\nZIP TIES\nTAPE\nWIRE\nCONNECTORS\nCLEANING' } },
  { cat: 'Parts bins', group: 'Sets', name: 'Battery status bins', doc: { ...BIN, title: '', body: 'CHARGED | Ready to fly\nSTORAGE | 3.8 V per cell\nNEEDS CHARGE\nDAMAGED | Recycle - do not use' } },

  // ===== Checklists =====
  { cat: 'Checklists', group: 'Shop', name: 'Repair intake', doc: { type: 'checklist', title: 'REPAIR INTAKE', body: 'Customer contact confirmed\nDevice model / serial recorded\nPhotos of condition taken\nAccessories logged\nBatteries checked for swelling\nProblem described by customer\nEstimate approved / limit set\nData backup discussed' } },
  { cat: 'Checklists', group: 'Shop', name: 'Drone QC after repair', doc: { type: 'checklist', title: 'DRONE QC', body: 'Firmware up to date\nIMU calibrated\nCompass calibrated\nGimbal calibrated, no drift\nAll motors spin freely, no noise\nProps checked\nController linked\nVideo feed OK\nHover test 2 min, stable\nReturn-to-Home set' } },
  { cat: 'Checklists', group: 'Shop', name: 'Phone QC after repair', doc: { type: 'checklist', title: 'PHONE QC', body: 'Display and touch OK\nFront / rear cameras\nFace / fingerprint unlock\nSpeakers and microphone\nCharging and battery health\nWi-Fi / Bluetooth / cellular\nButtons and vibration\nScrews and seal installed' } },
  { cat: 'Checklists', group: 'Shop', name: 'Customer pickup', doc: { type: 'checklist', title: 'PICKUP', body: 'Repair explained to customer\nPayment collected\nAccessories returned\nCalibration reminder given\nWarranty terms given' } },
  { cat: 'Checklists', group: 'Shop', name: 'Shipping / packing', doc: { type: 'checklist', title: 'PACKING', body: 'Batteries at storage charge\nProps removed\nGimbal lock / cover installed\nAccessories bagged\nInvoice / ticket included\nBox sealed and labeled\nTracking # recorded' } },
  { cat: 'Checklists', group: 'Flying', name: 'Pre-flight', doc: { type: 'checklist', title: 'PRE-FLIGHT', body: 'Batteries charged (aircraft + controller)\nProps secure and undamaged\nGimbal clamp removed\nSD card in, space free\nFirmware / app updated\nAirspace checked\nWeather / wind checked\nHome point recorded\nRemote ID active' } },
  { cat: 'Checklists', group: 'Flying', name: 'Battery check', doc: { type: 'checklist', title: 'BATTERY CHECK', body: 'No swelling or dents\nConnector clean, not melted\nCell voltages balanced\nCycle count logged\nFirmware current' } },
];

// A preset that sets showDate but not showTime shows/hides both together.
export const presets = rawPresets.map(p => ({ ...p, doc: { ...p.doc, ...('showDate' in p.doc && !('showTime' in p.doc) ? { showTime: p.doc.showDate } : {}) } }));

// ---------- heading presets (Heading tab) ----------
// Each one changes only the look. Your shop name, lines and logo stay as you set them,
// except presets that list tagline/info, which fill those in as a starting point.
export const headingPresets = [
  { name: 'Classic (big bold name)', set: { headStyle: 'classic', nameScale: 2, showLogo: true } },
  { name: 'Black bar', set: { headStyle: 'bar', nameScale: 1.6, showLogo: true } },
  { name: 'Boxed name', set: { headStyle: 'boxed', nameScale: 1.8, showLogo: true } },
  { name: 'Double lines', set: { headStyle: 'lines', nameScale: 1.8, showLogo: true } },
  { name: 'Extra large name', set: { headStyle: 'big', nameScale: 2.2, showLogo: false } },
  { name: 'Minimal (left aligned)', set: { headStyle: 'minimal', nameScale: 1.2, showLogo: false } },
  { name: 'Logo only', set: { headStyle: 'logo', showLogo: true } },
  { name: 'Logo + name', set: { headStyle: 'classic', nameScale: 1.6, showLogo: true } },
  { name: 'Drone repair shop', set: { headStyle: 'classic', nameScale: 2, tagline: 'Drone & Device Repair', info: '' } },
  { name: 'With contact lines', set: { headStyle: 'classic', nameScale: 2, tagline: 'Drone & Device Repair', info: 'Phone: ____________\nWeb: ____________' } },
  { name: 'Bar + tagline', set: { headStyle: 'bar', nameScale: 1.6, tagline: 'UAV Repair · Parts · Service', info: '' } },
];
