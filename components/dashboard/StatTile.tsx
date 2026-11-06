import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = { label: string; value: string | number; hint?: string; size?: "lg" | "sm" };

export function StatTile({ label, value, hint, size = "lg" }: Props) {
  return (
    <Card data-testid="stat-tile">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("tabular-nums", size === "lg" ? "text-4xl" : "text-2xl")} data-testid="stat-value">
          {value}
        </CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-muted-foreground -mt-2 text-xs">{hint}</CardContent>}
    </Card>
  );
}
