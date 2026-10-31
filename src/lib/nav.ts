export interface NavItem {
  name: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Inventory', href: '/components' },
  { name: 'Import / Export', href: '/import-export' },
  { name: 'Receipt Review', href: '/receipt-review' },
  { name: 'Component ID', href: '/identify' },
  { name: 'Dropdown Management', href: '/settings' },
  { name: 'Projects & BOM', href: '/projects' },
  { name: 'Custody & Loans', href: '/loans' },
  { name: 'Purchase Pipeline', href: '/purchase-list' },
];
