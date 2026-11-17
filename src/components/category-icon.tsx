import {
  Blocks,
  Boxes,
  Gamepad2,
  Gift,
  KeyRound,
  MonitorPlay,
  Package,
  PcCase,
  Smartphone,
  Sparkles,
  Zap,
  type LucideProps,
} from "lucide-react";

const icons = {
  Gamepad2,
  Zap,
  MonitorPlay,
  Boxes,
  Blocks,
  Smartphone,
  PcCase,
  Gift,
  KeyRound,
  Sparkles,
  Package,
} satisfies Record<string, React.ComponentType<LucideProps>>;

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = icons[name as keyof typeof icons] ?? Gamepad2;
  return <Icon {...props} />;
}
