// Asks for a secret at a terminal without showing it: each character typed or
// pasted is drawn as an asterisk, so the value reaches neither the screen nor
// a scrollback. Used by the walkthrough when the preview's secret isn't in the
// environment.
//
// The asterisks are there on purpose. A prompt that draws nothing looks dead,
// and the first person to meet one concluded it took no typing at all.

/**
 * Prints `prompt`, reads one line from `input` with echo off, drawing an
 * asterisk for each character, and resolves with the line (trimmed). Rejects
 * if the reader presses Ctrl-C. `input` must be a terminal (it needs raw
 * mode).
 */
export function askHidden(prompt, input = process.stdin, output = process.stdout) {
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (settle, result) => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      settle(result);
    };
    function onData(chunk) {
      // A paste arrives as one chunk, so every character is looked at in turn.
      for (const ch of String(chunk)) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish(resolve, value.trim());
        if (ch === "\u0003") return finish(reject, new Error("canceled"));
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = [...value].slice(0, -1).join("");
            output.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          output.write("*");
        }
      }
    }
    output.write(prompt);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    input.on("data", onData);
  });
}
