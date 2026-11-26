// The two fields Mizzen 0.2.7 adds to every unit's props. A test that does not care which component a
// unit asks for gets an engine that renders none; a test that does builds the registry with `build()`.
import type { RenderComponent } from "@velella/mizzen/contracts";

/** A `renderComponent` for a unit test: every name is unknown, so it renders nothing. */
export const noComponents: RenderComponent = () => "";

/** What a component's props carry beyond `props`, `page`, `site` and `html`. */
export const componentFields = { inline: false, renderComponent: noComponents } as const;
