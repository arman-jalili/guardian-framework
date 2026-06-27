#!/usr/bin/env bun
/**
 * CLI entry point for guardian-framework.
 */

import { runCli } from "./index.js";

runCli().catch(console.error);
