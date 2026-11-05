# Writing and editing Nucleus docs

Write for the page's existing audience. The Unity guides assume a Unity developer learning Nucleus; the core API guides address developers using that API directly. Keep those paths distinct.

For readability edits, keep the page's scope, voice, section order, and technical meaning. Prefer a small formatting change over a rewrite. Clearer instructions should require less guessing, not omit necessary detail.

## Make instructions easy to follow

- Use numbered steps for actions that must happen in order. Start with the action and name the object, window, or file it applies to.
- Keep a short menu path in one step, such as **Tools > Nucleus**. Split a paragraph that asks the reader to configure several things or move between windows.
- Place an existing prerequisite before the action that needs it. Link to the full setup procedure instead of copying it into every page.
- Separate an action from its explanation and expected result. Use an observable result already established by the docs; do not invent a success signal.
- Use bullets for independent requirements or cases. Keep conceptual explanations as paragraphs and use tables when readers need to compare values.
- Mark optional work explicitly. Keep conditions such as Pro-only support, server/client roles, and when a setting takes effect beside the relevant instruction.
- Keep existing headings and paths where possible so links and bookmarks continue to work. Match UI labels exactly in **bold**; use backticks for identifiers, paths, and literal values.

For example, a paragraph that tells the reader to open a window, choose a tab, and change a setting can become a short numbered list. Put the explanation of what the setting does after the list. Do not repeat the same instruction in both places.

## Keep enough context

Pages may be reached from search, a direct link, or an assistant retrieving one section. Name the relevant component or setting instead of relying on "it" or "the above." Keep short restrictions near the code or step they qualify, even when a longer explanation lives elsewhere.

Remove duplicated explanations selectively. A reminder about authority, replay, incompatible components, or a version restriction can prevent an incorrect implementation. Preserve its condition and consequence.

Use the same Markdown as the source for the website and machine-readable exports. Keep exact API names and descriptive link text. Required instructions should be available as text, not only in an image. Readability edits do not need a separate LLM-written copy of each page.

## Preserve meaning

A formatting change is not an opportunity to change API examples or resolve uncertain behavior from memory. If a technical statement appears wrong, report it separately. A correction needs evidence from the matching Nucleus implementation or version, with a source reference and any validation performed.

Before submitting a readability PR, check:

- [ ] Identifiers, UI labels, code examples, literal values, and defaults are preserved.
- [ ] Prerequisites, required versus optional work, and execution order are preserved.
- [ ] Server, client, host, controller, and observer responsibilities remain explicit and unchanged.
- [ ] Tick timing, replay rules, lifecycle constraints, and error or missing-input behavior are preserved.
- [ ] Exceptions, limitations, version/edition restrictions, and expected results are preserved.
- [ ] Existing headings, paths, and link destinations still work; any intentional changes are explained.
- [ ] Removed repetition does not remove a condition needed to use a nearby instruction or example correctly.
- [ ] The rendered page and Markdown export keep lists, code, and their qualifying notes together.

## Check and describe the change

Use the [local build instructions](README.md#build-locally), inspect the affected pages, and check their links and Markdown output. A successful site build does not prove that a Unity example runs or that a technical claim is correct.

Describe the formatting improvement and verification in the PR. Distinguish source review, build checks, LLM reading checks, and a person following the instructions. Report checks that were not run. Judge readability by missed steps, backtracking, and incorrect interpretations; a shorter page is not necessarily a better page.
