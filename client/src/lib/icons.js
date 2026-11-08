// The only place that maps a "kind" from the API to an icon.
// New kind from the backend? Add one line here (unknown kinds fall back to a default icon).
import {
  Building2,
  CarFront,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Home,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";

export const ICONS = {
  // card headers
  wallet: WalletCards,
  home: Home,
  car: CarFront,
  // accounts
  checking: CreditCard,
  savings: PiggyBank,
  credit: CreditCard,
  // home
  housing: Building2,
  utilities: Zap,
  // vehicle
  payment: ReceiptText,
  insurance: ShieldCheck,
  gas: Fuel,
  maintenance: Wrench,
  // nudges
  trend: PiggyBank,
  treat: Sparkles,
};

export const DEFAULT_ICON = CircleDollarSign;
