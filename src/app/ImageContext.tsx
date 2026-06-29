/**
 * ImageContext — provides the {@link ImagePort} to the UI and a small hook for
 * auto-generating royalty-free spot/temple images on demand (Req 4.7 + AI 自動
 * 画像生成).
 *
 * The app mounts {@link ImageProvider} with `gateway.image` (mock by default,
 * Bedrock-backed when AWS is configured). Screens call {@link useGeneratedImage}
 * for any subject that has no usable real photo; while the image is generating
 * the UI shows a "生成中" placeholder, and on success it swaps in the result.
 *
 * Two module-level caches keep this cheap and correct:
 *  - `memoryCache` — generated images by subject id, reused across remounts for
 *    the whole session (so re-swiping or revisiting never regenerates).
 *  - `inFlight` — de-dupes concurrent requests for the same id (e.g. the active
 *    card and its "peek" both ask for the next subject at once).
 *
 * The provider is injectable/testable: a test can pass a fake ImagePort.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { GeneratedImage, ImagePort, ImagePrompt } from "../ports";

const ImagePortContext = createContext<ImagePort | null>(null);

export interface ImageProviderProps {
  /** Image backend; inject `gateway.image` in the app, a fake in tests. */
  image: ImagePort;
  children: ReactNode;
}

export function ImageProvider({
  image,
  children,
}: ImageProviderProps): JSX.Element {
  return (
    <ImagePortContext.Provider value={image}>
      {children}
    </ImagePortContext.Provider>
  );
}

// Session-lifetime caches shared by every hook instance.
const memoryCache = new Map<string, GeneratedImage>();
const inFlight = new Map<string, Promise<GeneratedImage | null>>();

/** State of an on-demand image generation. */
export type GeneratedImageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; image: GeneratedImage }
  | { status: "error" };

/**
 * Returns the generated image for `prompt`, generating it (once) when needed.
 *
 * Pass `enabled = false` (or `prompt = null`) to skip generation entirely — use
 * this when a real photo already exists so the generator is never invoked.
 */
export function useGeneratedImage(
  prompt: ImagePrompt | null,
  enabled: boolean,
): GeneratedImageState {
  const image = useContext(ImagePortContext);
  const id = prompt?.id ?? null;

  const [state, setState] = useState<GeneratedImageState>(() =>
    id && memoryCache.has(id)
      ? { status: "ready", image: memoryCache.get(id)! }
      : { status: "idle" },
  );

  useEffect(() => {
    if (!enabled || !image || !prompt || !id) {
      return;
    }

    const cached = memoryCache.get(id);
    if (cached) {
      setState({ status: "ready", image: cached });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    let request = inFlight.get(id);
    if (!request) {
      request = image.generateImage(prompt).catch(() => null);
      inFlight.set(id, request);
    }

    request.then((result) => {
      inFlight.delete(id);
      if (result) memoryCache.set(id, result);
      if (cancelled) return;
      setState(
        result ? { status: "ready", image: result } : { status: "error" },
      );
    });

    return () => {
      cancelled = true;
    };
    // Re-run only when the subject id or enabled flag changes; the prompt's
    // other fields are stable for a given id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, image, id]);

  return state;
}
