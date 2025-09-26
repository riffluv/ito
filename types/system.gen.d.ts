import type { ConditionalValue, CssProperties } from "../css.types"
import type { UtilityValues, WithEscapeHatch } from "./prop-types.gen"
import type { Token } from "./token.gen"
type AnyString = string & Record<string, never>
type AnyNumber = number & Record<string, never>
type CssVars = `var(--${string})`
type CssVarValue = ConditionalValue<Token | CssVars | AnyString | AnyNumber>
type CssVarKey = `--${string}`
export type CssVarProperties = {
  [key in CssVarKey]?: CssVarValue | undefined
}

export interface SystemProperties {
  WebkitAppearance?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitAppearance"] | undefined>> | undefined
  WebkitBorderBefore?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitBorderBefore"] | undefined>> | undefined
  WebkitBorderBeforeColor?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitBorderBeforeColor"] | undefined>> | undefined
  WebkitBorderBeforeStyle?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitBorderBeforeStyle"] | undefined>> | undefined
  WebkitBorderBeforeWidth?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitBorderBeforeWidth"] | undefined>> | undefined
  WebkitBoxReflect?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitBoxReflect"] | undefined>> | undefined
  WebkitLineClamp?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitLineClamp"] | undefined>> | undefined
  WebkitMask?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMask"] | undefined>> | undefined
  WebkitMaskAttachment?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskAttachment"] | undefined>> | undefined
  WebkitMaskClip?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskClip"] | undefined>> | undefined
  WebkitMaskComposite?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskComposite"] | undefined>> | undefined
  WebkitMaskImage?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskImage"] | undefined>> | undefined
  WebkitMaskOrigin?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskOrigin"] | undefined>> | undefined
  WebkitMaskPosition?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskPosition"] | undefined>> | undefined
  WebkitMaskPositionX?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskPositionX"] | undefined>> | undefined
  WebkitMaskPositionY?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskPositionY"] | undefined>> | undefined
  WebkitMaskRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskRepeat"] | undefined>> | undefined
  WebkitMaskRepeatX?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskRepeatX"] | undefined>> | undefined
  WebkitMaskRepeatY?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskRepeatY"] | undefined>> | undefined
  WebkitMaskSize?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitMaskSize"] | undefined>> | undefined
  WebkitOverflowScrolling?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitOverflowScrolling"] | undefined>> | undefined
  WebkitTapHighlightColor?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTapHighlightColor"] | undefined>> | undefined
  WebkitTextFillColor?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTextFillColor"] | undefined>> | undefined
  WebkitTextStroke?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTextStroke"] | undefined>> | undefined
  WebkitTextStrokeColor?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTextStrokeColor"] | undefined>> | undefined
  WebkitTextStrokeWidth?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTextStrokeWidth"] | undefined>> | undefined
  WebkitTouchCallout?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitTouchCallout"] | undefined>> | undefined
  WebkitUserModify?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitUserModify"] | undefined>> | undefined
  WebkitUserSelect?: ConditionalValue<WithEscapeHatch<CssProperties["WebkitUserSelect"] | undefined>> | undefined
  accentColor?: ConditionalValue<WithEscapeHatch<UtilityValues["accentColor"] | CssVars | undefined>> | undefined
  alignContent?: ConditionalValue<WithEscapeHatch<CssProperties["alignContent"] | undefined>> | undefined
  alignItems?: ConditionalValue<WithEscapeHatch<CssProperties["alignItems"] | undefined>> | undefined
  alignSelf?: ConditionalValue<WithEscapeHatch<CssProperties["alignSelf"] | undefined>> | undefined
  alignTracks?: ConditionalValue<WithEscapeHatch<CssProperties["alignTracks"] | undefined>> | undefined
  all?: ConditionalValue<WithEscapeHatch<CssProperties["all"] | undefined>> | undefined
  anchorName?: ConditionalValue<WithEscapeHatch<CssProperties["anchorName"] | undefined>> | undefined
  anchorScope?: ConditionalValue<WithEscapeHatch<CssProperties["anchorScope"] | undefined>> | undefined
  animation?: ConditionalValue<WithEscapeHatch<UtilityValues["animation"] | CssVars | undefined>> | undefined
  animationComposition?: ConditionalValue<WithEscapeHatch<CssProperties["animationComposition"] | undefined>> | undefined
  animationDelay?: ConditionalValue<WithEscapeHatch<UtilityValues["animationDelay"] | CssVars | undefined>> | undefined
  animationDirection?: ConditionalValue<WithEscapeHatch<CssProperties["animationDirection"] | undefined>> | undefined
  animationDuration?: ConditionalValue<WithEscapeHatch<UtilityValues["animationDuration"] | CssVars | undefined>> | undefined
  animationFillMode?: ConditionalValue<WithEscapeHatch<CssProperties["animationFillMode"] | undefined>> | undefined
  animationIterationCount?: ConditionalValue<WithEscapeHatch<CssProperties["animationIterationCount"] | undefined>> | undefined
  animationName?: ConditionalValue<WithEscapeHatch<UtilityValues["animationName"] | CssVars | undefined>> | undefined
  animationPlayState?: ConditionalValue<WithEscapeHatch<CssProperties["animationPlayState"] | undefined>> | undefined
  animationRange?: ConditionalValue<WithEscapeHatch<CssProperties["animationRange"] | undefined>> | undefined
  animationRangeEnd?: ConditionalValue<WithEscapeHatch<CssProperties["animationRangeEnd"] | undefined>> | undefined
  animationRangeStart?: ConditionalValue<WithEscapeHatch<CssProperties["animationRangeStart"] | undefined>> | undefined
  animationTimeline?: ConditionalValue<WithEscapeHatch<CssProperties["animationTimeline"] | undefined>> | undefined
  animationTimingFunction?: ConditionalValue<WithEscapeHatch<UtilityValues["animationTimingFunction"] | CssVars | undefined>> | undefined
  appearance?: ConditionalValue<WithEscapeHatch<CssProperties["appearance"] | undefined>> | undefined
  aspectRatio?: ConditionalValue<WithEscapeHatch<UtilityValues["aspectRatio"] | CssVars | undefined>> | undefined
  backdropFilter?: ConditionalValue<WithEscapeHatch<CssProperties["backdropFilter"] | undefined>> | undefined
  backfaceVisibility?: ConditionalValue<WithEscapeHatch<CssProperties["backfaceVisibility"] | undefined>> | undefined
  background?: ConditionalValue<WithEscapeHatch<UtilityValues["background"] | CssVars | undefined>> | undefined
  backgroundAttachment?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundAttachment"] | undefined>> | undefined
  backgroundBlendMode?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundBlendMode"] | undefined>> | undefined
  backgroundClip?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundClip"] | CssVars | undefined>> | undefined
  backgroundColor?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundColor"] | CssVars | undefined>> | undefined
  backgroundImage?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundImage"] | CssVars | undefined>> | undefined
  backgroundOrigin?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundOrigin"] | undefined>> | undefined
  backgroundPosition?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundPosition"] | undefined>> | undefined
  backgroundPositionX?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundPositionX"] | undefined>> | undefined
  backgroundPositionY?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundPositionY"] | undefined>> | undefined
  backgroundRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundRepeat"] | undefined>> | undefined
  backgroundSize?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundSize"] | undefined>> | undefined
  blockSize?: ConditionalValue<WithEscapeHatch<UtilityValues["blockSize"] | CssVars | undefined>> | undefined
  border?: ConditionalValue<WithEscapeHatch<UtilityValues["border"] | CssVars | undefined>> | undefined
  borderBlock?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlock"] | CssVars | undefined>> | undefined
  borderBlockColor?: ConditionalValue<WithEscapeHatch<CssProperties["borderBlockColor"] | undefined>> | undefined
  borderBlockEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockEnd"] | CssVars | undefined>> | undefined
  borderBlockEndColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockEndColor"] | CssVars | undefined>> | undefined
  borderBlockEndStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockEndStyle"] | CssVars | undefined>> | undefined
  borderBlockEndWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockEndWidth"] | CssVars | undefined>> | undefined
  borderBlockStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockStart"] | CssVars | undefined>> | undefined
  borderBlockStartColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockStartColor"] | CssVars | undefined>> | undefined
  borderBlockStartStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockStartStyle"] | CssVars | undefined>> | undefined
  borderBlockStartWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockStartWidth"] | CssVars | undefined>> | undefined
  borderBlockStyle?: ConditionalValue<WithEscapeHatch<CssProperties["borderBlockStyle"] | undefined>> | undefined
  borderBlockWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockWidth"] | CssVars | undefined>> | undefined
  borderBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottom"] | CssVars | undefined>> | undefined
  borderBottomColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomColor"] | CssVars | undefined>> | undefined
  borderBottomLeftRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomLeftRadius"] | CssVars | undefined>> | undefined
  borderBottomRightRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomRightRadius"] | CssVars | undefined>> | undefined
  borderBottomStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomStyle"] | CssVars | undefined>> | undefined
  borderBottomWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomWidth"] | CssVars | undefined>> | undefined
  borderCollapse?: ConditionalValue<WithEscapeHatch<CssProperties["borderCollapse"] | undefined>> | undefined
  borderColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderColor"] | CssVars | undefined>> | undefined
  borderEndEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndEndRadius"] | CssVars | undefined>> | undefined
  borderEndStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndStartRadius"] | CssVars | undefined>> | undefined
  borderImage?: ConditionalValue<WithEscapeHatch<CssProperties["borderImage"] | undefined>> | undefined
  borderImageOutset?: ConditionalValue<WithEscapeHatch<CssProperties["borderImageOutset"] | undefined>> | undefined
  borderImageRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["borderImageRepeat"] | undefined>> | undefined
  borderImageSlice?: ConditionalValue<WithEscapeHatch<CssProperties["borderImageSlice"] | undefined>> | undefined
  borderImageSource?: ConditionalValue<WithEscapeHatch<CssProperties["borderImageSource"] | undefined>> | undefined
  borderImageWidth?: ConditionalValue<WithEscapeHatch<CssProperties["borderImageWidth"] | undefined>> | undefined
  borderInline?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInline"] | CssVars | undefined>> | undefined
  borderInlineColor?: ConditionalValue<WithEscapeHatch<CssProperties["borderInlineColor"] | undefined>> | undefined
  borderInlineEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEnd"] | CssVars | undefined>> | undefined
  borderInlineEndColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndColor"] | CssVars | undefined>> | undefined
  borderInlineEndStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndStyle"] | CssVars | undefined>> | undefined
  borderInlineEndWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndWidth"] | CssVars | undefined>> | undefined
  borderInlineStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStart"] | CssVars | undefined>> | undefined
  borderInlineStartColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartColor"] | CssVars | undefined>> | undefined
  borderInlineStartStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartStyle"] | CssVars | undefined>> | undefined
  borderInlineStartWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartWidth"] | CssVars | undefined>> | undefined
  borderInlineStyle?: ConditionalValue<WithEscapeHatch<CssProperties["borderInlineStyle"] | undefined>> | undefined
  borderInlineWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineWidth"] | CssVars | undefined>> | undefined
  borderLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeft"] | CssVars | undefined>> | undefined
  borderLeftColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeftColor"] | CssVars | undefined>> | undefined
  borderLeftStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeftStyle"] | CssVars | undefined>> | undefined
  borderLeftWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeftWidth"] | CssVars | undefined>> | undefined
  borderRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRadius"] | CssVars | undefined>> | undefined
  borderRight?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRight"] | CssVars | undefined>> | undefined
  borderRightColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRightColor"] | CssVars | undefined>> | undefined
  borderRightStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRightStyle"] | CssVars | undefined>> | undefined
  borderRightWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRightWidth"] | CssVars | undefined>> | undefined
  borderSpacing?: ConditionalValue<WithEscapeHatch<UtilityValues["borderSpacing"] | CssVars | undefined>> | undefined
  borderStartEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartEndRadius"] | CssVars | undefined>> | undefined
  borderStartStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartStartRadius"] | CssVars | undefined>> | undefined
  borderStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStyle"] | CssVars | undefined>> | undefined
  borderTop?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTop"] | CssVars | undefined>> | undefined
  borderTopColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopColor"] | CssVars | undefined>> | undefined
  borderTopLeftRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopLeftRadius"] | CssVars | undefined>> | undefined
  borderTopRightRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopRightRadius"] | CssVars | undefined>> | undefined
  borderTopStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopStyle"] | CssVars | undefined>> | undefined
  borderTopWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopWidth"] | CssVars | undefined>> | undefined
  borderWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderWidth"] | CssVars | undefined>> | undefined
  bottom?: ConditionalValue<WithEscapeHatch<UtilityValues["bottom"] | CssVars | undefined>> | undefined
  boxAlign?: ConditionalValue<WithEscapeHatch<CssProperties["boxAlign"] | undefined>> | undefined
  boxDecorationBreak?: ConditionalValue<WithEscapeHatch<CssProperties["boxDecorationBreak"] | undefined>> | undefined
  boxDirection?: ConditionalValue<WithEscapeHatch<CssProperties["boxDirection"] | undefined>> | undefined
  boxFlex?: ConditionalValue<WithEscapeHatch<CssProperties["boxFlex"] | undefined>> | undefined
  boxFlexGroup?: ConditionalValue<WithEscapeHatch<CssProperties["boxFlexGroup"] | undefined>> | undefined
  boxLines?: ConditionalValue<WithEscapeHatch<CssProperties["boxLines"] | undefined>> | undefined
  boxOrdinalGroup?: ConditionalValue<WithEscapeHatch<CssProperties["boxOrdinalGroup"] | undefined>> | undefined
  boxOrient?: ConditionalValue<WithEscapeHatch<CssProperties["boxOrient"] | undefined>> | undefined
  boxPack?: ConditionalValue<WithEscapeHatch<CssProperties["boxPack"] | undefined>> | undefined
  boxShadow?: ConditionalValue<WithEscapeHatch<UtilityValues["boxShadow"] | CssVars | undefined>> | undefined
  boxSizing?: ConditionalValue<WithEscapeHatch<CssProperties["boxSizing"] | undefined>> | undefined
  breakAfter?: ConditionalValue<WithEscapeHatch<CssProperties["breakAfter"] | undefined>> | undefined
  breakBefore?: ConditionalValue<WithEscapeHatch<CssProperties["breakBefore"] | undefined>> | undefined
  breakInside?: ConditionalValue<WithEscapeHatch<CssProperties["breakInside"] | undefined>> | undefined
  captionSide?: ConditionalValue<WithEscapeHatch<CssProperties["captionSide"] | undefined>> | undefined
  caret?: ConditionalValue<WithEscapeHatch<CssProperties["caret"] | undefined>> | undefined
  caretColor?: ConditionalValue<WithEscapeHatch<UtilityValues["caretColor"] | CssVars | undefined>> | undefined
  caretShape?: ConditionalValue<WithEscapeHatch<CssProperties["caretShape"] | undefined>> | undefined
  clear?: ConditionalValue<WithEscapeHatch<CssProperties["clear"] | undefined>> | undefined
  clip?: ConditionalValue<WithEscapeHatch<CssProperties["clip"] | undefined>> | undefined
  clipPath?: ConditionalValue<WithEscapeHatch<CssProperties["clipPath"] | undefined>> | undefined
  clipRule?: ConditionalValue<WithEscapeHatch<CssProperties["clipRule"] | undefined>> | undefined
  color?: ConditionalValue<WithEscapeHatch<UtilityValues["color"] | CssVars | undefined>> | undefined
  colorInterpolationFilters?: ConditionalValue<WithEscapeHatch<CssProperties["colorInterpolationFilters"] | undefined>> | undefined
  colorScheme?: ConditionalValue<WithEscapeHatch<CssProperties["colorScheme"] | undefined>> | undefined
  columnCount?: ConditionalValue<WithEscapeHatch<CssProperties["columnCount"] | undefined>> | undefined
  columnFill?: ConditionalValue<WithEscapeHatch<CssProperties["columnFill"] | undefined>> | undefined
  columnGap?: ConditionalValue<WithEscapeHatch<UtilityValues["columnGap"] | CssVars | undefined>> | undefined
  columnRule?: ConditionalValue<WithEscapeHatch<CssProperties["columnRule"] | undefined>> | undefined
  columnRuleColor?: ConditionalValue<WithEscapeHatch<CssProperties["columnRuleColor"] | undefined>> | undefined
  columnRuleStyle?: ConditionalValue<WithEscapeHatch<CssProperties["columnRuleStyle"] | undefined>> | undefined
  columnRuleWidth?: ConditionalValue<WithEscapeHatch<CssProperties["columnRuleWidth"] | undefined>> | undefined
  columnSpan?: ConditionalValue<WithEscapeHatch<CssProperties["columnSpan"] | undefined>> | undefined
  columnWidth?: ConditionalValue<WithEscapeHatch<CssProperties["columnWidth"] | undefined>> | undefined
  columns?: ConditionalValue<WithEscapeHatch<CssProperties["columns"] | undefined>> | undefined
  contain?: ConditionalValue<WithEscapeHatch<CssProperties["contain"] | undefined>> | undefined
  containIntrinsicBlockSize?: ConditionalValue<WithEscapeHatch<CssProperties["containIntrinsicBlockSize"] | undefined>> | undefined
  containIntrinsicHeight?: ConditionalValue<WithEscapeHatch<CssProperties["containIntrinsicHeight"] | undefined>> | undefined
  containIntrinsicInlineSize?: ConditionalValue<WithEscapeHatch<CssProperties["containIntrinsicInlineSize"] | undefined>> | undefined
  containIntrinsicSize?: ConditionalValue<WithEscapeHatch<CssProperties["containIntrinsicSize"] | undefined>> | undefined
  containIntrinsicWidth?: ConditionalValue<WithEscapeHatch<CssProperties["containIntrinsicWidth"] | undefined>> | undefined
  container?: ConditionalValue<WithEscapeHatch<CssProperties["container"] | undefined>> | undefined
  containerName?: ConditionalValue<WithEscapeHatch<CssProperties["containerName"] | undefined>> | undefined
  containerType?: ConditionalValue<WithEscapeHatch<CssProperties["containerType"] | undefined>> | undefined
  content?: ConditionalValue<WithEscapeHatch<CssProperties["content"] | undefined>> | undefined
  contentVisibility?: ConditionalValue<WithEscapeHatch<CssProperties["contentVisibility"] | undefined>> | undefined
  counterIncrement?: ConditionalValue<WithEscapeHatch<CssProperties["counterIncrement"] | undefined>> | undefined
  counterReset?: ConditionalValue<WithEscapeHatch<CssProperties["counterReset"] | undefined>> | undefined
  counterSet?: ConditionalValue<WithEscapeHatch<CssProperties["counterSet"] | undefined>> | undefined
  cursor?: ConditionalValue<WithEscapeHatch<UtilityValues["cursor"] | CssVars | undefined>> | undefined
  cx?: ConditionalValue<WithEscapeHatch<CssProperties["cx"] | undefined>> | undefined
  cy?: ConditionalValue<WithEscapeHatch<CssProperties["cy"] | undefined>> | undefined
  d?: ConditionalValue<WithEscapeHatch<CssProperties["d"] | undefined>> | undefined
  direction?: ConditionalValue<WithEscapeHatch<CssProperties["direction"] | undefined>> | undefined
  display?: ConditionalValue<WithEscapeHatch<CssProperties["display"] | undefined>> | undefined
  dominantBaseline?: ConditionalValue<WithEscapeHatch<CssProperties["dominantBaseline"] | undefined>> | undefined
  emptyCells?: ConditionalValue<WithEscapeHatch<CssProperties["emptyCells"] | undefined>> | undefined
  fieldSizing?: ConditionalValue<WithEscapeHatch<CssProperties["fieldSizing"] | undefined>> | undefined
  fill?: ConditionalValue<WithEscapeHatch<UtilityValues["fill"] | CssVars | undefined>> | undefined
  fillOpacity?: ConditionalValue<WithEscapeHatch<CssProperties["fillOpacity"] | undefined>> | undefined
  fillRule?: ConditionalValue<WithEscapeHatch<CssProperties["fillRule"] | undefined>> | undefined
  filter?: ConditionalValue<WithEscapeHatch<CssProperties["filter"] | undefined>> | undefined
  flex?: ConditionalValue<WithEscapeHatch<CssProperties["flex"] | undefined>> | undefined
  flexBasis?: ConditionalValue<WithEscapeHatch<UtilityValues["flexBasis"] | CssVars | undefined>> | undefined
  flexDirection?: ConditionalValue<WithEscapeHatch<CssProperties["flexDirection"] | undefined>> | undefined
  flexFlow?: ConditionalValue<WithEscapeHatch<CssProperties["flexFlow"] | undefined>> | undefined
  flexGrow?: ConditionalValue<WithEscapeHatch<CssProperties["flexGrow"] | undefined>> | undefined
  flexShrink?: ConditionalValue<WithEscapeHatch<CssProperties["flexShrink"] | undefined>> | undefined
  flexWrap?: ConditionalValue<WithEscapeHatch<CssProperties["flexWrap"] | undefined>> | undefined
  float?: ConditionalValue<WithEscapeHatch<CssProperties["float"] | undefined>> | undefined
  floodColor?: ConditionalValue<WithEscapeHatch<CssProperties["floodColor"] | undefined>> | undefined
  floodOpacity?: ConditionalValue<WithEscapeHatch<CssProperties["floodOpacity"] | undefined>> | undefined
  font?: ConditionalValue<WithEscapeHatch<CssProperties["font"] | undefined>> | undefined
  fontFamily?: ConditionalValue<WithEscapeHatch<UtilityValues["fontFamily"] | CssVars | undefined>> | undefined
  fontFeatureSettings?: ConditionalValue<WithEscapeHatch<CssProperties["fontFeatureSettings"] | undefined>> | undefined
  fontKerning?: ConditionalValue<WithEscapeHatch<CssProperties["fontKerning"] | undefined>> | undefined
  fontLanguageOverride?: ConditionalValue<WithEscapeHatch<CssProperties["fontLanguageOverride"] | undefined>> | undefined
  fontOpticalSizing?: ConditionalValue<WithEscapeHatch<CssProperties["fontOpticalSizing"] | undefined>> | undefined
  fontPalette?: ConditionalValue<WithEscapeHatch<CssProperties["fontPalette"] | undefined>> | undefined
  fontSize?: ConditionalValue<WithEscapeHatch<UtilityValues["fontSize"] | CssVars | undefined>> | undefined
  fontSizeAdjust?: ConditionalValue<WithEscapeHatch<CssProperties["fontSizeAdjust"] | undefined>> | undefined
  fontSmooth?: ConditionalValue<WithEscapeHatch<CssProperties["fontSmooth"] | undefined>> | undefined
  fontStretch?: ConditionalValue<WithEscapeHatch<CssProperties["fontStretch"] | undefined>> | undefined
  fontStyle?: ConditionalValue<WithEscapeHatch<CssProperties["fontStyle"] | undefined>> | undefined
  fontSynthesis?: ConditionalValue<WithEscapeHatch<CssProperties["fontSynthesis"] | undefined>> | undefined
  fontSynthesisPosition?: ConditionalValue<WithEscapeHatch<CssProperties["fontSynthesisPosition"] | undefined>> | undefined
  fontSynthesisSmallCaps?: ConditionalValue<WithEscapeHatch<CssProperties["fontSynthesisSmallCaps"] | undefined>> | undefined
  fontSynthesisStyle?: ConditionalValue<WithEscapeHatch<CssProperties["fontSynthesisStyle"] | undefined>> | undefined
  fontSynthesisWeight?: ConditionalValue<WithEscapeHatch<CssProperties["fontSynthesisWeight"] | undefined>> | undefined
  fontVariant?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariant"] | undefined>> | undefined
  fontVariantAlternates?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantAlternates"] | undefined>> | undefined
  fontVariantCaps?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantCaps"] | undefined>> | undefined
  fontVariantEastAsian?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantEastAsian"] | undefined>> | undefined
  fontVariantEmoji?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantEmoji"] | undefined>> | undefined
  fontVariantLigatures?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantLigatures"] | undefined>> | undefined
  fontVariantNumeric?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantNumeric"] | undefined>> | undefined
  fontVariantPosition?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariantPosition"] | undefined>> | undefined
  fontVariationSettings?: ConditionalValue<WithEscapeHatch<CssProperties["fontVariationSettings"] | undefined>> | undefined
  fontWeight?: ConditionalValue<WithEscapeHatch<UtilityValues["fontWeight"] | CssVars | undefined>> | undefined
  forcedColorAdjust?: ConditionalValue<WithEscapeHatch<CssProperties["forcedColorAdjust"] | undefined>> | undefined
  gap?: ConditionalValue<WithEscapeHatch<UtilityValues["gap"] | CssVars | undefined>> | undefined
  grid?: ConditionalValue<WithEscapeHatch<CssProperties["grid"] | undefined>> | undefined
  gridArea?: ConditionalValue<WithEscapeHatch<CssProperties["gridArea"] | undefined>> | undefined
  gridAutoColumns?: ConditionalValue<WithEscapeHatch<CssProperties["gridAutoColumns"] | undefined>> | undefined
  gridAutoFlow?: ConditionalValue<WithEscapeHatch<CssProperties["gridAutoFlow"] | undefined>> | undefined
  gridAutoRows?: ConditionalValue<WithEscapeHatch<CssProperties["gridAutoRows"] | undefined>> | undefined
  gridColumn?: ConditionalValue<WithEscapeHatch<CssProperties["gridColumn"] | undefined>> | undefined
  gridColumnEnd?: ConditionalValue<WithEscapeHatch<CssProperties["gridColumnEnd"] | undefined>> | undefined
  gridColumnGap?: ConditionalValue<WithEscapeHatch<UtilityValues["gridColumnGap"] | CssVars | undefined>> | undefined
  gridColumnStart?: ConditionalValue<WithEscapeHatch<CssProperties["gridColumnStart"] | undefined>> | undefined
  gridGap?: ConditionalValue<WithEscapeHatch<UtilityValues["gridGap"] | CssVars | undefined>> | undefined
  gridRow?: ConditionalValue<WithEscapeHatch<CssProperties["gridRow"] | undefined>> | undefined
  gridRowEnd?: ConditionalValue<WithEscapeHatch<CssProperties["gridRowEnd"] | undefined>> | undefined
  gridRowGap?: ConditionalValue<WithEscapeHatch<UtilityValues["gridRowGap"] | CssVars | undefined>> | undefined
  gridRowStart?: ConditionalValue<WithEscapeHatch<CssProperties["gridRowStart"] | undefined>> | undefined
  gridTemplate?: ConditionalValue<WithEscapeHatch<CssProperties["gridTemplate"] | undefined>> | undefined
  gridTemplateAreas?: ConditionalValue<WithEscapeHatch<CssProperties["gridTemplateAreas"] | undefined>> | undefined
  gridTemplateColumns?: ConditionalValue<WithEscapeHatch<CssProperties["gridTemplateColumns"] | undefined>> | undefined
  gridTemplateRows?: ConditionalValue<WithEscapeHatch<CssProperties["gridTemplateRows"] | undefined>> | undefined
  hangingPunctuation?: ConditionalValue<WithEscapeHatch<CssProperties["hangingPunctuation"] | undefined>> | undefined
  height?: ConditionalValue<WithEscapeHatch<UtilityValues["height"] | CssVars | undefined>> | undefined
  hyphenateCharacter?: ConditionalValue<WithEscapeHatch<CssProperties["hyphenateCharacter"] | undefined>> | undefined
  hyphenateLimitChars?: ConditionalValue<WithEscapeHatch<CssProperties["hyphenateLimitChars"] | undefined>> | undefined
  hyphens?: ConditionalValue<WithEscapeHatch<CssProperties["hyphens"] | undefined>> | undefined
  imageOrientation?: ConditionalValue<WithEscapeHatch<CssProperties["imageOrientation"] | undefined>> | undefined
  imageRendering?: ConditionalValue<WithEscapeHatch<CssProperties["imageRendering"] | undefined>> | undefined
  imageResolution?: ConditionalValue<WithEscapeHatch<CssProperties["imageResolution"] | undefined>> | undefined
  imeMode?: ConditionalValue<WithEscapeHatch<CssProperties["imeMode"] | undefined>> | undefined
  initialLetter?: ConditionalValue<WithEscapeHatch<CssProperties["initialLetter"] | undefined>> | undefined
  initialLetterAlign?: ConditionalValue<WithEscapeHatch<CssProperties["initialLetterAlign"] | undefined>> | undefined
  inlineSize?: ConditionalValue<WithEscapeHatch<UtilityValues["inlineSize"] | CssVars | undefined>> | undefined
  inset?: ConditionalValue<WithEscapeHatch<UtilityValues["inset"] | CssVars | undefined>> | undefined
  insetBlock?: ConditionalValue<WithEscapeHatch<UtilityValues["insetBlock"] | CssVars | undefined>> | undefined
  insetBlockEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["insetBlockEnd"] | CssVars | undefined>> | undefined
  insetBlockStart?: ConditionalValue<WithEscapeHatch<UtilityValues["insetBlockStart"] | CssVars | undefined>> | undefined
  insetInline?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInline"] | CssVars | undefined>> | undefined
  insetInlineEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInlineEnd"] | CssVars | undefined>> | undefined
  insetInlineStart?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInlineStart"] | CssVars | undefined>> | undefined
  interpolateSize?: ConditionalValue<WithEscapeHatch<CssProperties["interpolateSize"] | undefined>> | undefined
  isolation?: ConditionalValue<WithEscapeHatch<CssProperties["isolation"] | undefined>> | undefined
  justifyContent?: ConditionalValue<WithEscapeHatch<CssProperties["justifyContent"] | undefined>> | undefined
  justifyItems?: ConditionalValue<WithEscapeHatch<CssProperties["justifyItems"] | undefined>> | undefined
  justifySelf?: ConditionalValue<WithEscapeHatch<CssProperties["justifySelf"] | undefined>> | undefined
  justifyTracks?: ConditionalValue<WithEscapeHatch<CssProperties["justifyTracks"] | undefined>> | undefined
  left?: ConditionalValue<WithEscapeHatch<UtilityValues["left"] | CssVars | undefined>> | undefined
  letterSpacing?: ConditionalValue<WithEscapeHatch<UtilityValues["letterSpacing"] | CssVars | undefined>> | undefined
  lightingColor?: ConditionalValue<WithEscapeHatch<CssProperties["lightingColor"] | undefined>> | undefined
  lineBreak?: ConditionalValue<WithEscapeHatch<CssProperties["lineBreak"] | undefined>> | undefined
  lineClamp?: ConditionalValue<WithEscapeHatch<CssProperties["lineClamp"] | undefined>> | undefined
  lineHeight?: ConditionalValue<WithEscapeHatch<UtilityValues["lineHeight"] | CssVars | undefined>> | undefined
  lineHeightStep?: ConditionalValue<WithEscapeHatch<CssProperties["lineHeightStep"] | undefined>> | undefined
  listStyle?: ConditionalValue<WithEscapeHatch<CssProperties["listStyle"] | undefined>> | undefined
  listStyleImage?: ConditionalValue<WithEscapeHatch<UtilityValues["listStyleImage"] | CssVars | undefined>> | undefined
  listStylePosition?: ConditionalValue<WithEscapeHatch<CssProperties["listStylePosition"] | undefined>> | undefined
  listStyleType?: ConditionalValue<WithEscapeHatch<CssProperties["listStyleType"] | undefined>> | undefined
  margin?: ConditionalValue<WithEscapeHatch<UtilityValues["margin"] | CssVars | undefined>> | undefined
  marginBlock?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBlock"] | CssVars | undefined>> | undefined
  marginBlockEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBlockEnd"] | CssVars | undefined>> | undefined
  marginBlockStart?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBlockStart"] | CssVars | undefined>> | undefined
  marginBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBottom"] | CssVars | undefined>> | undefined
  marginInline?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInline"] | CssVars | undefined>> | undefined
  marginInlineEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineEnd"] | CssVars | undefined>> | undefined
  marginInlineStart?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineStart"] | CssVars | undefined>> | undefined
  marginLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["marginLeft"] | CssVars | undefined>> | undefined
  marginRight?: ConditionalValue<WithEscapeHatch<UtilityValues["marginRight"] | CssVars | undefined>> | undefined
  marginTop?: ConditionalValue<WithEscapeHatch<UtilityValues["marginTop"] | CssVars | undefined>> | undefined
  marginTrim?: ConditionalValue<WithEscapeHatch<CssProperties["marginTrim"] | undefined>> | undefined
  marker?: ConditionalValue<WithEscapeHatch<CssProperties["marker"] | undefined>> | undefined
  markerEnd?: ConditionalValue<WithEscapeHatch<CssProperties["markerEnd"] | undefined>> | undefined
  markerMid?: ConditionalValue<WithEscapeHatch<CssProperties["markerMid"] | undefined>> | undefined
  markerStart?: ConditionalValue<WithEscapeHatch<CssProperties["markerStart"] | undefined>> | undefined
  mask?: ConditionalValue<WithEscapeHatch<CssProperties["mask"] | undefined>> | undefined
  maskBorder?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorder"] | undefined>> | undefined
  maskBorderMode?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderMode"] | undefined>> | undefined
  maskBorderOutset?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderOutset"] | undefined>> | undefined
  maskBorderRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderRepeat"] | undefined>> | undefined
  maskBorderSlice?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderSlice"] | undefined>> | undefined
  maskBorderSource?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderSource"] | undefined>> | undefined
  maskBorderWidth?: ConditionalValue<WithEscapeHatch<CssProperties["maskBorderWidth"] | undefined>> | undefined
  maskClip?: ConditionalValue<WithEscapeHatch<CssProperties["maskClip"] | undefined>> | undefined
  maskComposite?: ConditionalValue<WithEscapeHatch<CssProperties["maskComposite"] | undefined>> | undefined
  maskImage?: ConditionalValue<WithEscapeHatch<CssProperties["maskImage"] | undefined>> | undefined
  maskMode?: ConditionalValue<WithEscapeHatch<CssProperties["maskMode"] | undefined>> | undefined
  maskOrigin?: ConditionalValue<WithEscapeHatch<CssProperties["maskOrigin"] | undefined>> | undefined
  maskPosition?: ConditionalValue<WithEscapeHatch<CssProperties["maskPosition"] | undefined>> | undefined
  maskRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["maskRepeat"] | undefined>> | undefined
  maskSize?: ConditionalValue<WithEscapeHatch<CssProperties["maskSize"] | undefined>> | undefined
  maskType?: ConditionalValue<WithEscapeHatch<CssProperties["maskType"] | undefined>> | undefined
  masonryAutoFlow?: ConditionalValue<WithEscapeHatch<CssProperties["masonryAutoFlow"] | undefined>> | undefined
  mathDepth?: ConditionalValue<WithEscapeHatch<CssProperties["mathDepth"] | undefined>> | undefined
  mathShift?: ConditionalValue<WithEscapeHatch<CssProperties["mathShift"] | undefined>> | undefined
  mathStyle?: ConditionalValue<WithEscapeHatch<CssProperties["mathStyle"] | undefined>> | undefined
  maxBlockSize?: ConditionalValue<WithEscapeHatch<UtilityValues["maxBlockSize"] | CssVars | undefined>> | undefined
  maxHeight?: ConditionalValue<WithEscapeHatch<UtilityValues["maxHeight"] | CssVars | undefined>> | undefined
  maxInlineSize?: ConditionalValue<WithEscapeHatch<UtilityValues["maxInlineSize"] | CssVars | undefined>> | undefined
  maxLines?: ConditionalValue<WithEscapeHatch<CssProperties["maxLines"] | undefined>> | undefined
  maxWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["maxWidth"] | CssVars | undefined>> | undefined
  minBlockSize?: ConditionalValue<WithEscapeHatch<UtilityValues["minBlockSize"] | CssVars | undefined>> | undefined
  minHeight?: ConditionalValue<WithEscapeHatch<UtilityValues["minHeight"] | CssVars | undefined>> | undefined
  minInlineSize?: ConditionalValue<WithEscapeHatch<UtilityValues["minInlineSize"] | CssVars | undefined>> | undefined
  minWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["minWidth"] | CssVars | undefined>> | undefined
  mixBlendMode?: ConditionalValue<WithEscapeHatch<CssProperties["mixBlendMode"] | undefined>> | undefined
  objectFit?: ConditionalValue<WithEscapeHatch<CssProperties["objectFit"] | undefined>> | undefined
  objectPosition?: ConditionalValue<WithEscapeHatch<CssProperties["objectPosition"] | undefined>> | undefined
  offset?: ConditionalValue<WithEscapeHatch<CssProperties["offset"] | undefined>> | undefined
  offsetAnchor?: ConditionalValue<WithEscapeHatch<CssProperties["offsetAnchor"] | undefined>> | undefined
  offsetDistance?: ConditionalValue<WithEscapeHatch<CssProperties["offsetDistance"] | undefined>> | undefined
  offsetPath?: ConditionalValue<WithEscapeHatch<CssProperties["offsetPath"] | undefined>> | undefined
  offsetPosition?: ConditionalValue<WithEscapeHatch<CssProperties["offsetPosition"] | undefined>> | undefined
  offsetRotate?: ConditionalValue<WithEscapeHatch<CssProperties["offsetRotate"] | undefined>> | undefined
  opacity?: ConditionalValue<WithEscapeHatch<UtilityValues["opacity"] | CssVars | undefined>> | undefined
  order?: ConditionalValue<WithEscapeHatch<CssProperties["order"] | undefined>> | undefined
  orphans?: ConditionalValue<WithEscapeHatch<CssProperties["orphans"] | undefined>> | undefined
  outline?: ConditionalValue<WithEscapeHatch<CssProperties["outline"] | undefined>> | undefined
  outlineColor?: ConditionalValue<WithEscapeHatch<UtilityValues["outlineColor"] | CssVars | undefined>> | undefined
  outlineOffset?: ConditionalValue<WithEscapeHatch<CssProperties["outlineOffset"] | undefined>> | undefined
  outlineStyle?: ConditionalValue<WithEscapeHatch<CssProperties["outlineStyle"] | undefined>> | undefined
  outlineWidth?: ConditionalValue<WithEscapeHatch<CssProperties["outlineWidth"] | undefined>> | undefined
  overflow?: ConditionalValue<WithEscapeHatch<CssProperties["overflow"] | undefined>> | undefined
  overflowAnchor?: ConditionalValue<WithEscapeHatch<CssProperties["overflowAnchor"] | undefined>> | undefined
  overflowBlock?: ConditionalValue<WithEscapeHatch<CssProperties["overflowBlock"] | undefined>> | undefined
  overflowClipBox?: ConditionalValue<WithEscapeHatch<CssProperties["overflowClipBox"] | undefined>> | undefined
  overflowClipMargin?: ConditionalValue<WithEscapeHatch<CssProperties["overflowClipMargin"] | undefined>> | undefined
  overflowInline?: ConditionalValue<WithEscapeHatch<CssProperties["overflowInline"] | undefined>> | undefined
  overflowWrap?: ConditionalValue<WithEscapeHatch<CssProperties["overflowWrap"] | undefined>> | undefined
  overflowX?: ConditionalValue<WithEscapeHatch<CssProperties["overflowX"] | undefined>> | undefined
  overflowY?: ConditionalValue<WithEscapeHatch<CssProperties["overflowY"] | undefined>> | undefined
  overlay?: ConditionalValue<WithEscapeHatch<CssProperties["overlay"] | undefined>> | undefined
  overscrollBehavior?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehavior"] | undefined>> | undefined
  overscrollBehaviorBlock?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorBlock"] | undefined>> | undefined
  overscrollBehaviorInline?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorInline"] | undefined>> | undefined
  overscrollBehaviorX?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorX"] | undefined>> | undefined
  overscrollBehaviorY?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorY"] | undefined>> | undefined
  padding?: ConditionalValue<WithEscapeHatch<UtilityValues["padding"] | CssVars | undefined>> | undefined
  paddingBlock?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBlock"] | CssVars | undefined>> | undefined
  paddingBlockEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBlockEnd"] | CssVars | undefined>> | undefined
  paddingBlockStart?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBlockStart"] | CssVars | undefined>> | undefined
  paddingBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBottom"] | CssVars | undefined>> | undefined
  paddingInline?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInline"] | CssVars | undefined>> | undefined
  paddingInlineEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineEnd"] | CssVars | undefined>> | undefined
  paddingInlineStart?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineStart"] | CssVars | undefined>> | undefined
  paddingLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingLeft"] | CssVars | undefined>> | undefined
  paddingRight?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingRight"] | CssVars | undefined>> | undefined
  paddingTop?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingTop"] | CssVars | undefined>> | undefined
  page?: ConditionalValue<WithEscapeHatch<CssProperties["page"] | undefined>> | undefined
  pageBreakAfter?: ConditionalValue<WithEscapeHatch<CssProperties["pageBreakAfter"] | undefined>> | undefined
  pageBreakBefore?: ConditionalValue<WithEscapeHatch<CssProperties["pageBreakBefore"] | undefined>> | undefined
  pageBreakInside?: ConditionalValue<WithEscapeHatch<CssProperties["pageBreakInside"] | undefined>> | undefined
  paintOrder?: ConditionalValue<WithEscapeHatch<CssProperties["paintOrder"] | undefined>> | undefined
  perspective?: ConditionalValue<WithEscapeHatch<CssProperties["perspective"] | undefined>> | undefined
  perspectiveOrigin?: ConditionalValue<WithEscapeHatch<CssProperties["perspectiveOrigin"] | undefined>> | undefined
  placeContent?: ConditionalValue<WithEscapeHatch<CssProperties["placeContent"] | undefined>> | undefined
  placeItems?: ConditionalValue<WithEscapeHatch<CssProperties["placeItems"] | undefined>> | undefined
  placeSelf?: ConditionalValue<WithEscapeHatch<CssProperties["placeSelf"] | undefined>> | undefined
  pointerEvents?: ConditionalValue<WithEscapeHatch<CssProperties["pointerEvents"] | undefined>> | undefined
  position?: ConditionalValue<WithEscapeHatch<CssProperties["position"] | undefined>> | undefined
  positionAnchor?: ConditionalValue<WithEscapeHatch<CssProperties["positionAnchor"] | undefined>> | undefined
  positionArea?: ConditionalValue<WithEscapeHatch<CssProperties["positionArea"] | undefined>> | undefined
  positionTry?: ConditionalValue<WithEscapeHatch<CssProperties["positionTry"] | undefined>> | undefined
  positionTryFallbacks?: ConditionalValue<WithEscapeHatch<CssProperties["positionTryFallbacks"] | undefined>> | undefined
  positionTryOrder?: ConditionalValue<WithEscapeHatch<CssProperties["positionTryOrder"] | undefined>> | undefined
  positionVisibility?: ConditionalValue<WithEscapeHatch<CssProperties["positionVisibility"] | undefined>> | undefined
  printColorAdjust?: ConditionalValue<WithEscapeHatch<CssProperties["printColorAdjust"] | undefined>> | undefined
  quotes?: ConditionalValue<WithEscapeHatch<CssProperties["quotes"] | undefined>> | undefined
  r?: ConditionalValue<WithEscapeHatch<CssProperties["r"] | undefined>> | undefined
  resize?: ConditionalValue<WithEscapeHatch<CssProperties["resize"] | undefined>> | undefined
  right?: ConditionalValue<WithEscapeHatch<UtilityValues["right"] | CssVars | undefined>> | undefined
  rotate?: ConditionalValue<WithEscapeHatch<CssProperties["rotate"] | undefined>> | undefined
  rowGap?: ConditionalValue<WithEscapeHatch<UtilityValues["rowGap"] | CssVars | undefined>> | undefined
  rubyAlign?: ConditionalValue<WithEscapeHatch<CssProperties["rubyAlign"] | undefined>> | undefined
  rubyMerge?: ConditionalValue<WithEscapeHatch<CssProperties["rubyMerge"] | undefined>> | undefined
  rubyPosition?: ConditionalValue<WithEscapeHatch<CssProperties["rubyPosition"] | undefined>> | undefined
  rx?: ConditionalValue<WithEscapeHatch<CssProperties["rx"] | undefined>> | undefined
  ry?: ConditionalValue<WithEscapeHatch<CssProperties["ry"] | undefined>> | undefined
  scale?: ConditionalValue<WithEscapeHatch<CssProperties["scale"] | undefined>> | undefined
  scrollBehavior?: ConditionalValue<WithEscapeHatch<CssProperties["scrollBehavior"] | undefined>> | undefined
  scrollMargin?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMargin"] | CssVars | undefined>> | undefined
  scrollMarginBlock?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginBlock"] | undefined>> | undefined
  scrollMarginBlockEnd?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginBlockEnd"] | undefined>> | undefined
  scrollMarginBlockStart?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginBlockStart"] | undefined>> | undefined
  scrollMarginBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginBottom"] | CssVars | undefined>> | undefined
  scrollMarginInline?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginInline"] | undefined>> | undefined
  scrollMarginInlineEnd?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginInlineEnd"] | undefined>> | undefined
  scrollMarginInlineStart?: ConditionalValue<WithEscapeHatch<CssProperties["scrollMarginInlineStart"] | undefined>> | undefined
  scrollMarginLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginLeft"] | CssVars | undefined>> | undefined
  scrollMarginRight?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginRight"] | CssVars | undefined>> | undefined
  scrollMarginTop?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginTop"] | CssVars | undefined>> | undefined
  scrollPadding?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPadding"] | CssVars | undefined>> | undefined
  scrollPaddingBlock?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingBlock"] | CssVars | undefined>> | undefined
  scrollPaddingBlockEnd?: ConditionalValue<WithEscapeHatch<CssProperties["scrollPaddingBlockEnd"] | undefined>> | undefined
  scrollPaddingBlockStart?: ConditionalValue<WithEscapeHatch<CssProperties["scrollPaddingBlockStart"] | undefined>> | undefined
  scrollPaddingBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingBottom"] | CssVars | undefined>> | undefined
  scrollPaddingInline?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingInline"] | CssVars | undefined>> | undefined
  scrollPaddingInlineEnd?: ConditionalValue<WithEscapeHatch<CssProperties["scrollPaddingInlineEnd"] | undefined>> | undefined
  scrollPaddingInlineStart?: ConditionalValue<WithEscapeHatch<CssProperties["scrollPaddingInlineStart"] | undefined>> | undefined
  scrollPaddingLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingLeft"] | CssVars | undefined>> | undefined
  scrollPaddingRight?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingRight"] | CssVars | undefined>> | undefined
  scrollPaddingTop?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingTop"] | CssVars | undefined>> | undefined
  scrollSnapAlign?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapAlign"] | undefined>> | undefined
  scrollSnapCoordinate?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapCoordinate"] | undefined>> | undefined
  scrollSnapDestination?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapDestination"] | undefined>> | undefined
  scrollSnapPointsX?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapPointsX"] | undefined>> | undefined
  scrollSnapPointsY?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapPointsY"] | undefined>> | undefined
  scrollSnapStop?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapStop"] | undefined>> | undefined
  scrollSnapType?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapType"] | CssVars | undefined>> | undefined
  scrollSnapTypeX?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapTypeX"] | undefined>> | undefined
  scrollSnapTypeY?: ConditionalValue<WithEscapeHatch<CssProperties["scrollSnapTypeY"] | undefined>> | undefined
  scrollTimeline?: ConditionalValue<WithEscapeHatch<CssProperties["scrollTimeline"] | undefined>> | undefined
  scrollTimelineAxis?: ConditionalValue<WithEscapeHatch<CssProperties["scrollTimelineAxis"] | undefined>> | undefined
  scrollTimelineName?: ConditionalValue<WithEscapeHatch<CssProperties["scrollTimelineName"] | undefined>> | undefined
  scrollbarColor?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollbarColor"] | CssVars | undefined>> | undefined
  scrollbarGutter?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollbarGutter"] | CssVars | undefined>> | undefined
  scrollbarWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollbarWidth"] | CssVars | undefined>> | undefined
  shapeImageThreshold?: ConditionalValue<WithEscapeHatch<CssProperties["shapeImageThreshold"] | undefined>> | undefined
  shapeMargin?: ConditionalValue<WithEscapeHatch<CssProperties["shapeMargin"] | undefined>> | undefined
  shapeOutside?: ConditionalValue<WithEscapeHatch<CssProperties["shapeOutside"] | undefined>> | undefined
  shapeRendering?: ConditionalValue<WithEscapeHatch<CssProperties["shapeRendering"] | undefined>> | undefined
  stopColor?: ConditionalValue<WithEscapeHatch<CssProperties["stopColor"] | undefined>> | undefined
  stopOpacity?: ConditionalValue<WithEscapeHatch<CssProperties["stopOpacity"] | undefined>> | undefined
  stroke?: ConditionalValue<WithEscapeHatch<UtilityValues["stroke"] | CssVars | undefined>> | undefined
  strokeDasharray?: ConditionalValue<WithEscapeHatch<CssProperties["strokeDasharray"] | undefined>> | undefined
  strokeDashoffset?: ConditionalValue<WithEscapeHatch<CssProperties["strokeDashoffset"] | undefined>> | undefined
  strokeLinecap?: ConditionalValue<WithEscapeHatch<CssProperties["strokeLinecap"] | undefined>> | undefined
  strokeLinejoin?: ConditionalValue<WithEscapeHatch<CssProperties["strokeLinejoin"] | undefined>> | undefined
  strokeMiterlimit?: ConditionalValue<WithEscapeHatch<CssProperties["strokeMiterlimit"] | undefined>> | undefined
  strokeOpacity?: ConditionalValue<WithEscapeHatch<CssProperties["strokeOpacity"] | undefined>> | undefined
  strokeWidth?: ConditionalValue<WithEscapeHatch<CssProperties["strokeWidth"] | undefined>> | undefined
  tabSize?: ConditionalValue<WithEscapeHatch<CssProperties["tabSize"] | undefined>> | undefined
  tableLayout?: ConditionalValue<WithEscapeHatch<CssProperties["tableLayout"] | undefined>> | undefined
  textAlign?: ConditionalValue<WithEscapeHatch<CssProperties["textAlign"] | undefined>> | undefined
  textAlignLast?: ConditionalValue<WithEscapeHatch<CssProperties["textAlignLast"] | undefined>> | undefined
  textAnchor?: ConditionalValue<WithEscapeHatch<CssProperties["textAnchor"] | undefined>> | undefined
  textBox?: ConditionalValue<WithEscapeHatch<CssProperties["textBox"] | undefined>> | undefined
  textBoxEdge?: ConditionalValue<WithEscapeHatch<CssProperties["textBoxEdge"] | undefined>> | undefined
  textBoxTrim?: ConditionalValue<WithEscapeHatch<CssProperties["textBoxTrim"] | undefined>> | undefined
  textCombineUpright?: ConditionalValue<WithEscapeHatch<CssProperties["textCombineUpright"] | undefined>> | undefined
  textDecoration?: ConditionalValue<WithEscapeHatch<CssProperties["textDecoration"] | undefined>> | undefined
  textDecorationColor?: ConditionalValue<WithEscapeHatch<UtilityValues["textDecorationColor"] | CssVars | undefined>> | undefined
  textDecorationLine?: ConditionalValue<WithEscapeHatch<CssProperties["textDecorationLine"] | undefined>> | undefined
  textDecorationSkip?: ConditionalValue<WithEscapeHatch<CssProperties["textDecorationSkip"] | undefined>> | undefined
  textDecorationSkipInk?: ConditionalValue<WithEscapeHatch<CssProperties["textDecorationSkipInk"] | undefined>> | undefined
  textDecorationStyle?: ConditionalValue<WithEscapeHatch<CssProperties["textDecorationStyle"] | undefined>> | undefined
  textDecorationThickness?: ConditionalValue<WithEscapeHatch<CssProperties["textDecorationThickness"] | undefined>> | undefined
  textEmphasis?: ConditionalValue<WithEscapeHatch<CssProperties["textEmphasis"] | undefined>> | undefined
  textEmphasisColor?: ConditionalValue<WithEscapeHatch<CssProperties["textEmphasisColor"] | undefined>> | undefined
  textEmphasisPosition?: ConditionalValue<WithEscapeHatch<CssProperties["textEmphasisPosition"] | undefined>> | undefined
  textEmphasisStyle?: ConditionalValue<WithEscapeHatch<CssProperties["textEmphasisStyle"] | undefined>> | undefined
  textIndent?: ConditionalValue<WithEscapeHatch<UtilityValues["textIndent"] | CssVars | undefined>> | undefined
  textJustify?: ConditionalValue<WithEscapeHatch<CssProperties["textJustify"] | undefined>> | undefined
  textOrientation?: ConditionalValue<WithEscapeHatch<CssProperties["textOrientation"] | undefined>> | undefined
  textOverflow?: ConditionalValue<WithEscapeHatch<CssProperties["textOverflow"] | undefined>> | undefined
  textRendering?: ConditionalValue<WithEscapeHatch<CssProperties["textRendering"] | undefined>> | undefined
  textShadow?: ConditionalValue<WithEscapeHatch<UtilityValues["textShadow"] | CssVars | undefined>> | undefined
  textSizeAdjust?: ConditionalValue<WithEscapeHatch<CssProperties["textSizeAdjust"] | undefined>> | undefined
  textSpacingTrim?: ConditionalValue<WithEscapeHatch<CssProperties["textSpacingTrim"] | undefined>> | undefined
  textTransform?: ConditionalValue<WithEscapeHatch<CssProperties["textTransform"] | undefined>> | undefined
  textUnderlineOffset?: ConditionalValue<WithEscapeHatch<CssProperties["textUnderlineOffset"] | undefined>> | undefined
  textUnderlinePosition?: ConditionalValue<WithEscapeHatch<CssProperties["textUnderlinePosition"] | undefined>> | undefined
  textWrap?: ConditionalValue<WithEscapeHatch<CssProperties["textWrap"] | undefined>> | undefined
  textWrapMode?: ConditionalValue<WithEscapeHatch<CssProperties["textWrapMode"] | undefined>> | undefined
  textWrapStyle?: ConditionalValue<WithEscapeHatch<CssProperties["textWrapStyle"] | undefined>> | undefined
  timelineScope?: ConditionalValue<WithEscapeHatch<CssProperties["timelineScope"] | undefined>> | undefined
  top?: ConditionalValue<WithEscapeHatch<UtilityValues["top"] | CssVars | undefined>> | undefined
  touchAction?: ConditionalValue<WithEscapeHatch<CssProperties["touchAction"] | undefined>> | undefined
  transform?: ConditionalValue<WithEscapeHatch<CssProperties["transform"] | undefined>> | undefined
  transformBox?: ConditionalValue<WithEscapeHatch<CssProperties["transformBox"] | undefined>> | undefined
  transformOrigin?: ConditionalValue<WithEscapeHatch<CssProperties["transformOrigin"] | undefined>> | undefined
  transformStyle?: ConditionalValue<WithEscapeHatch<CssProperties["transformStyle"] | undefined>> | undefined
  transition?: ConditionalValue<WithEscapeHatch<UtilityValues["transition"] | CssVars | undefined>> | undefined
  transitionBehavior?: ConditionalValue<WithEscapeHatch<CssProperties["transitionBehavior"] | undefined>> | undefined
  transitionDelay?: ConditionalValue<WithEscapeHatch<CssProperties["transitionDelay"] | undefined>> | undefined
  transitionDuration?: ConditionalValue<WithEscapeHatch<UtilityValues["transitionDuration"] | CssVars | undefined>> | undefined
  transitionProperty?: ConditionalValue<WithEscapeHatch<UtilityValues["transitionProperty"] | CssVars | undefined>> | undefined
  transitionTimingFunction?: ConditionalValue<WithEscapeHatch<UtilityValues["transitionTimingFunction"] | CssVars | undefined>> | undefined
  translate?: ConditionalValue<WithEscapeHatch<CssProperties["translate"] | undefined>> | undefined
  unicodeBidi?: ConditionalValue<WithEscapeHatch<CssProperties["unicodeBidi"] | undefined>> | undefined
  userSelect?: ConditionalValue<WithEscapeHatch<CssProperties["userSelect"] | undefined>> | undefined
  vectorEffect?: ConditionalValue<WithEscapeHatch<CssProperties["vectorEffect"] | undefined>> | undefined
  verticalAlign?: ConditionalValue<WithEscapeHatch<CssProperties["verticalAlign"] | undefined>> | undefined
  viewTimeline?: ConditionalValue<WithEscapeHatch<CssProperties["viewTimeline"] | undefined>> | undefined
  viewTimelineAxis?: ConditionalValue<WithEscapeHatch<CssProperties["viewTimelineAxis"] | undefined>> | undefined
  viewTimelineInset?: ConditionalValue<WithEscapeHatch<CssProperties["viewTimelineInset"] | undefined>> | undefined
  viewTimelineName?: ConditionalValue<WithEscapeHatch<CssProperties["viewTimelineName"] | undefined>> | undefined
  viewTransitionName?: ConditionalValue<WithEscapeHatch<CssProperties["viewTransitionName"] | undefined>> | undefined
  visibility?: ConditionalValue<WithEscapeHatch<CssProperties["visibility"] | undefined>> | undefined
  whiteSpace?: ConditionalValue<WithEscapeHatch<CssProperties["whiteSpace"] | undefined>> | undefined
  whiteSpaceCollapse?: ConditionalValue<WithEscapeHatch<CssProperties["whiteSpaceCollapse"] | undefined>> | undefined
  widows?: ConditionalValue<WithEscapeHatch<CssProperties["widows"] | undefined>> | undefined
  width?: ConditionalValue<WithEscapeHatch<UtilityValues["width"] | CssVars | undefined>> | undefined
  willChange?: ConditionalValue<WithEscapeHatch<CssProperties["willChange"] | undefined>> | undefined
  wordBreak?: ConditionalValue<WithEscapeHatch<CssProperties["wordBreak"] | undefined>> | undefined
  wordSpacing?: ConditionalValue<WithEscapeHatch<CssProperties["wordSpacing"] | undefined>> | undefined
  wordWrap?: ConditionalValue<WithEscapeHatch<CssProperties["wordWrap"] | undefined>> | undefined
  writingMode?: ConditionalValue<WithEscapeHatch<CssProperties["writingMode"] | undefined>> | undefined
  x?: ConditionalValue<WithEscapeHatch<CssProperties["x"] | undefined>> | undefined
  y?: ConditionalValue<WithEscapeHatch<CssProperties["y"] | undefined>> | undefined
  zIndex?: ConditionalValue<WithEscapeHatch<UtilityValues["zIndex"] | CssVars | undefined>> | undefined
  zoom?: ConditionalValue<WithEscapeHatch<CssProperties["zoom"] | undefined>> | undefined
  alignmentBaseline?: ConditionalValue<WithEscapeHatch<CssProperties["alignmentBaseline"] | undefined>> | undefined
  baselineShift?: ConditionalValue<WithEscapeHatch<CssProperties["baselineShift"] | undefined>> | undefined
  colorInterpolation?: ConditionalValue<WithEscapeHatch<CssProperties["colorInterpolation"] | undefined>> | undefined
  colorRendering?: ConditionalValue<WithEscapeHatch<CssProperties["colorRendering"] | undefined>> | undefined
  glyphOrientationVertical?: ConditionalValue<WithEscapeHatch<CssProperties["glyphOrientationVertical"] | undefined>> | undefined
  bg?: ConditionalValue<WithEscapeHatch<UtilityValues["background"] | CssVars | undefined>> | undefined
  bgColor?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundColor"] | CssVars | undefined>> | undefined
  bgSize?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundSize"] | undefined>> | undefined
  bgPos?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundPosition"] | undefined>> | undefined
  bgRepeat?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundRepeat"] | undefined>> | undefined
  bgAttachment?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundAttachment"] | undefined>> | undefined
  bgClip?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundClip"] | CssVars | undefined>> | undefined
  bgGradient?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundGradient"] | CssVars | undefined>> | undefined
  bgImg?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundImage"] | CssVars | undefined>> | undefined
  bgImage?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundImage"] | CssVars | undefined>> | undefined
  borderStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStart"] | CssVars | undefined>> | undefined
  borderEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEnd"] | CssVars | undefined>> | undefined
  borderX?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInline"] | CssVars | undefined>> | undefined
  borderY?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlock"] | CssVars | undefined>> | undefined
  borderStartColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartColor"] | CssVars | undefined>> | undefined
  borderEndColor?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndColor"] | CssVars | undefined>> | undefined
  borderStartStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartStyle"] | CssVars | undefined>> | undefined
  borderEndStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndStyle"] | CssVars | undefined>> | undefined
  rounded?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRadius"] | CssVars | undefined>> | undefined
  roundedTopLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopLeftRadius"] | CssVars | undefined>> | undefined
  roundedStartStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartStartRadius"] | CssVars | undefined>> | undefined
  borderTopStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartStartRadius"] | CssVars | undefined>> | undefined
  roundedEndStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndStartRadius"] | CssVars | undefined>> | undefined
  borderBottomStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndStartRadius"] | CssVars | undefined>> | undefined
  roundedTopRight?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopRightRadius"] | CssVars | undefined>> | undefined
  roundedStartEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartEndRadius"] | CssVars | undefined>> | undefined
  borderTopEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderStartEndRadius"] | CssVars | undefined>> | undefined
  roundedEndEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndEndRadius"] | CssVars | undefined>> | undefined
  borderBottomEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderEndEndRadius"] | CssVars | undefined>> | undefined
  roundedBottomLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomLeftRadius"] | CssVars | undefined>> | undefined
  roundedBottomRight?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomRightRadius"] | CssVars | undefined>> | undefined
  roundedStart?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartRadius"] | CssVars | undefined>> | undefined
  borderStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartRadius"] | CssVars | undefined>> | undefined
  roundedEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndRadius"] | CssVars | undefined>> | undefined
  borderEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndRadius"] | CssVars | undefined>> | undefined
  roundedTop?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopRadius"] | CssVars | undefined>> | undefined
  roundedBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomRadius"] | CssVars | undefined>> | undefined
  roundedLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeftRadius"] | CssVars | undefined>> | undefined
  roundedRight?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRightRadius"] | CssVars | undefined>> | undefined
  borderXWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineWidth"] | CssVars | undefined>> | undefined
  borderStartWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartWidth"] | CssVars | undefined>> | undefined
  borderEndWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndWidth"] | CssVars | undefined>> | undefined
  borderYWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBlockWidth"] | CssVars | undefined>> | undefined
  shadow?: ConditionalValue<WithEscapeHatch<UtilityValues["boxShadow"] | CssVars | undefined>> | undefined
  shadowColor?: ConditionalValue<WithEscapeHatch<UtilityValues["boxShadowColor"] | CssVars | undefined>> | undefined
  blendMode?: ConditionalValue<WithEscapeHatch<CssProperties["mixBlendMode"] | undefined>> | undefined
  bgBlendMode?: ConditionalValue<WithEscapeHatch<CssProperties["backgroundBlendMode"] | undefined>> | undefined
  gapY?: ConditionalValue<WithEscapeHatch<UtilityValues["rowGap"] | CssVars | undefined>> | undefined
  gapX?: ConditionalValue<WithEscapeHatch<UtilityValues["columnGap"] | CssVars | undefined>> | undefined
  flexDir?: ConditionalValue<WithEscapeHatch<CssProperties["flexDirection"] | undefined>> | undefined
  w?: ConditionalValue<WithEscapeHatch<UtilityValues["width"] | CssVars | undefined>> | undefined
  h?: ConditionalValue<WithEscapeHatch<UtilityValues["height"] | CssVars | undefined>> | undefined
  minW?: ConditionalValue<WithEscapeHatch<UtilityValues["minWidth"] | CssVars | undefined>> | undefined
  minH?: ConditionalValue<WithEscapeHatch<UtilityValues["minHeight"] | CssVars | undefined>> | undefined
  maxW?: ConditionalValue<WithEscapeHatch<UtilityValues["maxWidth"] | CssVars | undefined>> | undefined
  maxH?: ConditionalValue<WithEscapeHatch<UtilityValues["maxHeight"] | CssVars | undefined>> | undefined
  overscroll?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehavior"] | undefined>> | undefined
  overscrollX?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorX"] | undefined>> | undefined
  overscrollY?: ConditionalValue<WithEscapeHatch<CssProperties["overscrollBehaviorY"] | undefined>> | undefined
  scrollPaddingX?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingInline"] | CssVars | undefined>> | undefined
  scrollPaddingY?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollPaddingBlock"] | CssVars | undefined>> | undefined
  listStylePos?: ConditionalValue<WithEscapeHatch<CssProperties["listStylePosition"] | undefined>> | undefined
  listStyleImg?: ConditionalValue<WithEscapeHatch<UtilityValues["listStyleImage"] | CssVars | undefined>> | undefined
  pos?: ConditionalValue<WithEscapeHatch<CssProperties["position"] | undefined>> | undefined
  insetX?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInline"] | CssVars | undefined>> | undefined
  insetY?: ConditionalValue<WithEscapeHatch<UtilityValues["insetBlock"] | CssVars | undefined>> | undefined
  insetStart?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInlineStart"] | CssVars | undefined>> | undefined
  insetEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["insetInlineEnd"] | CssVars | undefined>> | undefined
  m?: ConditionalValue<WithEscapeHatch<UtilityValues["margin"] | CssVars | undefined>> | undefined
  mt?: ConditionalValue<WithEscapeHatch<UtilityValues["marginTop"] | CssVars | undefined>> | undefined
  mr?: ConditionalValue<WithEscapeHatch<UtilityValues["marginRight"] | CssVars | undefined>> | undefined
  mb?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBottom"] | CssVars | undefined>> | undefined
  ml?: ConditionalValue<WithEscapeHatch<UtilityValues["marginLeft"] | CssVars | undefined>> | undefined
  ms?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineStart"] | CssVars | undefined>> | undefined
  marginStart?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineStart"] | CssVars | undefined>> | undefined
  me?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineEnd"] | CssVars | undefined>> | undefined
  marginEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInlineEnd"] | CssVars | undefined>> | undefined
  mx?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInline"] | CssVars | undefined>> | undefined
  marginX?: ConditionalValue<WithEscapeHatch<UtilityValues["marginInline"] | CssVars | undefined>> | undefined
  my?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBlock"] | CssVars | undefined>> | undefined
  marginY?: ConditionalValue<WithEscapeHatch<UtilityValues["marginBlock"] | CssVars | undefined>> | undefined
  p?: ConditionalValue<WithEscapeHatch<UtilityValues["padding"] | CssVars | undefined>> | undefined
  pt?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingTop"] | CssVars | undefined>> | undefined
  pr?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingRight"] | CssVars | undefined>> | undefined
  pb?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBottom"] | CssVars | undefined>> | undefined
  pl?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingLeft"] | CssVars | undefined>> | undefined
  ps?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineStart"] | CssVars | undefined>> | undefined
  paddingStart?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineStart"] | CssVars | undefined>> | undefined
  pe?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineEnd"] | CssVars | undefined>> | undefined
  paddingEnd?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInlineEnd"] | CssVars | undefined>> | undefined
  px?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInline"] | CssVars | undefined>> | undefined
  paddingX?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingInline"] | CssVars | undefined>> | undefined
  py?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBlock"] | CssVars | undefined>> | undefined
  paddingY?: ConditionalValue<WithEscapeHatch<UtilityValues["paddingBlock"] | CssVars | undefined>> | undefined
  textDecor?: ConditionalValue<WithEscapeHatch<CssProperties["textDecoration"] | undefined>> | undefined
  backgroundGradient?: ConditionalValue<WithEscapeHatch<UtilityValues["backgroundGradient"] | CssVars | undefined>> | undefined
  gradientFrom?: ConditionalValue<WithEscapeHatch<UtilityValues["gradientFrom"] | CssVars | undefined>> | undefined
  gradientTo?: ConditionalValue<WithEscapeHatch<UtilityValues["gradientTo"] | CssVars | undefined>> | undefined
  gradientVia?: ConditionalValue<WithEscapeHatch<UtilityValues["gradientVia"] | CssVars | undefined>> | undefined
  borderInlineStartRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineStartRadius"] | CssVars | undefined>> | undefined
  borderInlineEndRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderInlineEndRadius"] | CssVars | undefined>> | undefined
  borderTopRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderTopRadius"] | CssVars | undefined>> | undefined
  borderBottomRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderBottomRadius"] | CssVars | undefined>> | undefined
  borderLeftRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderLeftRadius"] | CssVars | undefined>> | undefined
  borderRightRadius?: ConditionalValue<WithEscapeHatch<UtilityValues["borderRightRadius"] | CssVars | undefined>> | undefined
  divideX?: ConditionalValue<WithEscapeHatch<UtilityValues["divideX"] | CssVars | undefined>> | undefined
  divideY?: ConditionalValue<WithEscapeHatch<UtilityValues["divideY"] | CssVars | undefined>> | undefined
  divideColor?: ConditionalValue<WithEscapeHatch<UtilityValues["divideColor"] | CssVars | undefined>> | undefined
  divideStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["divideStyle"] | CssVars | undefined>> | undefined
  boxShadowColor?: ConditionalValue<WithEscapeHatch<UtilityValues["boxShadowColor"] | CssVars | undefined>> | undefined
  blur?: ConditionalValue<WithEscapeHatch<UtilityValues["blur"] | CssVars | undefined>> | undefined
  brightness?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  contrast?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  grayscale?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  hueRotate?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  invert?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  saturate?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  sepia?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  dropShadow?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropBlur?: ConditionalValue<WithEscapeHatch<UtilityValues["backdropBlur"] | CssVars | undefined>> | undefined
  backdropBrightness?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropContrast?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropGrayscale?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropHueRotate?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropInvert?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropOpacity?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropSaturate?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  backdropSepia?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  focusRing?: ConditionalValue<WithEscapeHatch<UtilityValues["focusRing"] | CssVars | undefined>> | undefined
  focusVisibleRing?: ConditionalValue<WithEscapeHatch<UtilityValues["focusVisibleRing"] | CssVars | undefined>> | undefined
  focusRingColor?: ConditionalValue<WithEscapeHatch<UtilityValues["focusRingColor"] | CssVars | undefined>> | undefined
  focusRingOffset?: ConditionalValue<WithEscapeHatch<UtilityValues["focusRingOffset"] | CssVars | undefined>> | undefined
  focusRingWidth?: ConditionalValue<WithEscapeHatch<UtilityValues["focusRingWidth"] | CssVars | undefined>> | undefined
  focusRingStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["focusRingStyle"] | CssVars | undefined>> | undefined
  boxSize?: ConditionalValue<WithEscapeHatch<UtilityValues["boxSize"] | CssVars | undefined>> | undefined
  hideFrom?: ConditionalValue<WithEscapeHatch<UtilityValues["hideFrom"] | CssVars | undefined>> | undefined
  hideBelow?: ConditionalValue<WithEscapeHatch<UtilityValues["hideBelow"] | CssVars | undefined>> | undefined
  scrollbar?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollbar"] | CssVars | undefined>> | undefined
  scrollMarginX?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginX"] | CssVars | undefined>> | undefined
  scrollMarginY?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollMarginY"] | CssVars | undefined>> | undefined
  scrollSnapStrictness?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapStrictness"] | CssVars | undefined>> | undefined
  scrollSnapMargin?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapMargin"] | CssVars | undefined>> | undefined
  scrollSnapMarginTop?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapMarginTop"] | CssVars | undefined>> | undefined
  scrollSnapMarginBottom?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapMarginBottom"] | CssVars | undefined>> | undefined
  scrollSnapMarginLeft?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapMarginLeft"] | CssVars | undefined>> | undefined
  scrollSnapMarginRight?: ConditionalValue<WithEscapeHatch<UtilityValues["scrollSnapMarginRight"] | CssVars | undefined>> | undefined
  ring?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  ringColor?: ConditionalValue<WithEscapeHatch<UtilityValues["ringColor"] | CssVars | undefined>> | undefined
  ringOffset?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  ringOffsetColor?: ConditionalValue<WithEscapeHatch<UtilityValues["ringOffsetColor"] | CssVars | undefined>> | undefined
  ringInset?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  skewX?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  skewY?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  scaleX?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  scaleY?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  spaceXReverse?: ConditionalValue<WithEscapeHatch<UtilityValues["spaceXReverse"] | CssVars | undefined>> | undefined
  spaceX?: ConditionalValue<WithEscapeHatch<UtilityValues["spaceX"] | CssVars | undefined>> | undefined
  spaceYReverse?: ConditionalValue<WithEscapeHatch<UtilityValues["spaceYReverse"] | CssVars | undefined>> | undefined
  spaceY?: ConditionalValue<WithEscapeHatch<UtilityValues["spaceY"] | CssVars | undefined>> | undefined
  rotateX?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  rotateY?: ConditionalValue<WithEscapeHatch<string | number | undefined>> | undefined
  translateX?: ConditionalValue<WithEscapeHatch<UtilityValues["translateX"] | CssVars | undefined>> | undefined
  translateY?: ConditionalValue<WithEscapeHatch<UtilityValues["translateY"] | CssVars | undefined>> | undefined
  truncate?: ConditionalValue<WithEscapeHatch<UtilityValues["truncate"] | CssVars | undefined>> | undefined
  borderSpacingX?: ConditionalValue<WithEscapeHatch<UtilityValues["borderSpacingX"] | CssVars | undefined>> | undefined
  borderSpacingY?: ConditionalValue<WithEscapeHatch<UtilityValues["borderSpacingY"] | CssVars | undefined>> | undefined
  srOnly?: ConditionalValue<WithEscapeHatch<UtilityValues["srOnly"] | CssVars | undefined>> | undefined
  debug?: ConditionalValue<WithEscapeHatch<UtilityValues["debug"] | CssVars | undefined>> | undefined
  colorPalette?: ConditionalValue<WithEscapeHatch<UtilityValues["colorPalette"] | CssVars | undefined>> | undefined
  textStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["textStyle"] | CssVars | undefined>> | undefined
  layerStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["layerStyle"] | CssVars | undefined>> | undefined
  animationStyle?: ConditionalValue<WithEscapeHatch<UtilityValues["animationStyle"] | CssVars | undefined>> | undefined
}
