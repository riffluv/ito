import { scaleForDpi } from "@/components/ui/scaleForDpi";

export const SEINO_BUTTON_STYLES = {
  h: scaleForDpi("44px"),
  minH: scaleForDpi("44px"),
  minW: scaleForDpi("211px"),
  px: scaleForDpi("34px"),
  py: 0,
  position: "relative" as const,
  bg: "rgba(255,128,45,0.93)",
  color: "white",
  border: `${scaleForDpi("3px")} solid rgba(255,255,255,0.92)`,
  borderRadius: 0,
  fontWeight: "800",
  fontFamily: "monospace",
  fontSize: scaleForDpi("26px"),
  letterSpacing: "0.023em",
  lineHeight: "1",
  textShadow: `${scaleForDpi("2px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,0.85), ${scaleForDpi("1px")} ${scaleForDpi("1px")} ${scaleForDpi("2px")} rgba(0,0,0,0.6)`,
  boxShadow:
    `0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28)`,
  _before: {
    content: '""',
    position: "absolute" as const,
    top: scaleForDpi("3px"),
    left: scaleForDpi("4px"),
    right: scaleForDpi("3px"),
    bottom: scaleForDpi("3px"),
    background:
      "linear-gradient(178deg, rgba(255,255,255,0.12) 0%, transparent 48%, rgba(0,0,0,0.18) 100%)",
    pointerEvents: "none" as const,
  },
  _hover: {
    bg: "rgba(255,145,65,0.96)",
    color: "white",
    textShadow: `${scaleForDpi("2px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,0.92), ${scaleForDpi("1px")} ${scaleForDpi("2px")} ${scaleForDpi("3px")} rgba(0,0,0,0.65)`,
    borderColor: "rgba(255,255,255,0.95)",
    transform: `translateY(${scaleForDpi("-3px")})`,
    boxShadow:
      `0 0 0 ${scaleForDpi("2px")} rgba(235,110,35,0.85), ${scaleForDpi("6px")} ${scaleForDpi("8px")} 0 rgba(0,0,0,.48), ${scaleForDpi("5px")} ${scaleForDpi("7px")} 0 rgba(0,0,0,.4), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.28)`,
  },
  _active: {
    bg: "rgba(235,110,30,0.95)",
    color: "rgba(255,255,255,0.91)",
    boxShadow:
      `0 0 0 ${scaleForDpi("2px")} rgba(200,85,20,0.82), ${scaleForDpi("2px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.46), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.14)`,
    transform: `translateY(${scaleForDpi("1px")})`,
  },
} as const;
