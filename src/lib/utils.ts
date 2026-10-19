import { createCn, validators } from "cn/config";

// Class merging that knows the design tokens from src/styles/tokens.css:
// without it `text-14` is taken for a text color and dropped next to `text-ink`
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: [validators.isNumber] }] },
    theme: { leading: ["heading", "body", "card"] },
  },
});
