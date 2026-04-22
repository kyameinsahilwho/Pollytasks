import { mutation } from "./_generated/server";

export const swapNoteFields = mutation({
  args: {},
  handler: async (ctx) => {
    const weblogs = await ctx.db.query("weblogs").collect();
    let swappedCount = 0;

    for (const weblog of weblogs) {
      if (weblog.rawTranscript) {
        // Swap content and rawTranscript
        const oldContent = weblog.content;
        const oldTranscript = weblog.rawTranscript;

        await ctx.db.patch(weblog._id, {
          content: oldTranscript,
          rawTranscript: oldContent
        });
        swappedCount++;
      }
    }
    return `Successfully swapped fields for ${swappedCount} weblogs.`;
  }
});
