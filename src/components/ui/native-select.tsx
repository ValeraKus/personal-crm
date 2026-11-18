import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// shadcn/ui native-select: a plain <select> in the look of the project (same border, height and
// colors as Input, design tokens only). It works without JavaScript and opens the system list on
// a phone.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn("group/native-select relative w-full min-w-0", className)}
    >
      <select
        data-slot="native-select"
        className="h-11 w-full min-w-0 appearance-none border-2 border-ink bg-white py-1 pr-6 pl-2 sm:pr-8 sm:pl-3 text-16 text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger"
        {...props}
      />
      <ChevronDownIcon
        data-slot="native-select-icon"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 sm:right-3 sm:size-4 -translate-y-1/2 text-ink-muted select-none"
      />
    </div>
  );
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup({ ...props }: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
