import { query } from "./_generated/server";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const weblogs = await ctx.db.query("weblogs").collect();
    return weblogs.filter(w => w.rawTranscript).map(w => ({
      id: w._id,
      content: w.content ? w.content.substring(0, 50) + "..." : null,
      rawTranscript: w.rawTranscript ? w.rawTranscript.substring(0, 50) + "..." : null,
    }));
  }
});
