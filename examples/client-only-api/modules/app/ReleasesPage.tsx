import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, If, Match } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import Masthead from "./Masthead.tsx";
import type { Releases } from "./Releases.schema.ts";
import { githubApi } from "./githubApi.ts";

export const Props = s.object({});

type State = ResourceState<Infer<typeof Releases>>;

/** The latest releases from GitHub's API, shown by resource state: loading, failed, none, or the list. */
export default function ReleasesPage(_props: Infer<typeof Props>, ctx: Ctx) {
  const list = resource(() =>
    githubApi.releases({ params: { owner: "nodejs", repo: "node" }, query: { per_page: 5 } }, ctx),
  );
  return (
    <Box id="app.releases" direction="column" gap="2">
      <Masthead />
      <Box as="main" direction="column" gap="3" p="4">
        <Heading id="app.releases.title" level={1}>
          Latest Node.js releases
        </Heading>
        <Match on={list.get()}>
          <Case<State> tag="loading">
            {() => (
              <Text id="app.releases.loading" role="status" as="p" m="0">
                Loading releases
              </Text>
            )}
          </Case>
          <Case<State> tag="error">
            {() => (
              <Text id="app.releases.error" role="alert" as="p" m="0">
                The release list could not be read. Try again later.
              </Text>
            )}
          </Case>
          <Case<State> tag="ready">
            {(v) => (
              <Box direction="column" gap="2">
                <If when={v.value.length === 0}>
                  <Text id="app.releases.empty" as="p" m="0">
                    No releases yet.
                  </Text>
                </If>
                <Box as="ul" id="app.releases.list" direction="column" gap="2" p="0" m="0">
                  <For each={v.value} key="tag_name">
                    {(r) => (
                      <Box as="li" direction="row" gap="3">
                        <Text font="mono">{r.tag_name}</Text>
                        <Text>{r.name ?? ""}</Text>
                      </Box>
                    )}
                  </For>
                </Box>
              </Box>
            )}
          </Case>
        </Match>
      </Box>
    </Box>
  );
}
