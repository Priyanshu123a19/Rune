import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Standard Uploadthing handlers (for widget usage if needed)
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});