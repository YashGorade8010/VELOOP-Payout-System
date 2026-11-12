import { ArrowDownLeft, Gift, Smartphone } from 'lucide-react';

export const METHODS = {
  upi: {
    name: 'UPI Cash',
    caption: 'Cash redemption to your UPI ID',
    icon: ArrowDownLeft,
    tone: 'green',
  },
  amazon: {
    name: 'Amazon Gift Card',
    caption: 'Redeem as an Amazon gift card',
    icon: Gift,
    tone: 'amber',
  },
  googlePlay: {
    name: 'Google Play',
    caption: 'Apps, games and entertainment',
    icon: Smartphone,
    tone: 'cyan',
  },
};

export function getMethodDisplayName(methodKey, configuredName) {
  return configuredName || METHODS[methodKey]?.name || methodKey;
}
