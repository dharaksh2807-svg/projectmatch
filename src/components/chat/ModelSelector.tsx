"use client";

import { useChatStore } from "@/store/chatStore";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function ModelSelector() {
  const { availableModels, selectedModelId, setModel } = useChatStore();

  const groupedModels = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof availableModels>);

  return (
    <Select 
      value={selectedModelId || undefined} 
      onValueChange={(val) => { if (val) setModel(val); }}
    >
      <SelectTrigger className="w-[300px] bg-background border border-border text-foreground rounded-xl shadow-sm hover:bg-accent transition-colors">
        <SelectValue placeholder="Select a model..." />
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border text-popover-foreground rounded-xl shadow-2xl">
        {Object.entries(groupedModels).map(([provider, models]) => (
          <SelectGroup key={provider}>
            <SelectLabel className="text-muted-foreground font-semibold uppercase tracking-wider text-xs px-2 py-1.5">
              {provider}
            </SelectLabel>
            {models.map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                className="hover:bg-accent focus:bg-accent cursor-pointer rounded-lg mx-1"
              >
                <div className="flex items-center justify-between w-full space-x-3">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        model.isActive ? "bg-green-500" : "bg-muted-foreground/50"
                      }`}
                    />
                    <span className="font-medium text-sm text-foreground">
                      {model.name}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-border text-muted-foreground capitalize"
                  >
                    {model.tier}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
