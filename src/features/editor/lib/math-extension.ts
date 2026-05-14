import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import * as mathjs from "mathjs";

export const MathExtension = Extension.create({
  name: "math",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("math"),
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== "=") {
              return false;
            }

            const state = view.state;
            const $from = state.doc.resolve(from);

            // Find the start of the current text block
            const blockStart = $from.start();
            // Get the text before the cursor in the current block
            const textBeforeCursor = state.doc.textBetween(blockStart, from, "\n", "\ufffc");

            // Regex to find a potential math expression followed by an equals sign.
            // This is a simple regex and might need refinement for complex cases.
            // It looks for digits, operators, parens, and spaces.
            const match = textBeforeCursor.match(/([0-9+\-*/().\s]+)$/);

            if (match) {
              const expression = match[1].trim();
              if (expression.length > 0) {
                 try {
                    const result = mathjs.evaluate(expression);
                    // Only replace if it's a valid number result
                    if (typeof result === 'number' && !isNaN(result)) {
                      const matchStart = from - expression.length;

                      // Construct the new text to insert (the result)
                      const resultText = `=${result}`;

                      // Create a transaction to replace the expression + "=" with the result
                      const tr = state.tr
                        .insertText(resultText, from, from) // Insert the result at the cursor
                        .delete(matchStart, from); // Delete the original expression

                      view.dispatch(tr);
                      return true; // We handled the input
                    }
                 } catch {
                     // Expression was invalid math, do nothing
                 }
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
