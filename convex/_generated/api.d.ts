/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audio from "../audio.js";
import type * as challenges from "../challenges.js";
import type * as habits from "../habits.js";
import type * as http from "../http.js";
import type * as migration from "../migration.js";
import type * as projects from "../projects.js";
import type * as reminders from "../reminders.js";
import type * as social from "../social.js";
import type * as storage from "../storage.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as weblogs from "../weblogs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audio: typeof audio;
  challenges: typeof challenges;
  habits: typeof habits;
  http: typeof http;
  migration: typeof migration;
  projects: typeof projects;
  reminders: typeof reminders;
  social: typeof social;
  storage: typeof storage;
  tasks: typeof tasks;
  users: typeof users;
  utils: typeof utils;
  weblogs: typeof weblogs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
