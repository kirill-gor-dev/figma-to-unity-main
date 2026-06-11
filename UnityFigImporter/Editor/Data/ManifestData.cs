// =============================================================================
// ManifestData — C# data classes mirroring manifest.json schema v1.0
// =============================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace FigmaImporter.Data
{
    [Serializable]
    public class ManifestData
    {
        [JsonProperty("version")]
        public string Version;

        [JsonProperty("exportDate")]
        public string ExportDate;

        [JsonProperty("screen")]
        public ScreenData Screen;

        [JsonProperty("elements")]
        public List<ElementData> Elements;

        [JsonProperty("assets")]
        public List<AssetEntryData> Assets;

        [JsonProperty("fonts")]
        public List<FontEntryData> Fonts;
    }

    [Serializable]
    public class ScreenData
    {
        [JsonProperty("name")]
        public string Name;

        [JsonProperty("figmaSize")]
        public SizeData FigmaSize;

        [JsonProperty("unityRefResolution")]
        public SizeData UnityRefResolution;

        [JsonProperty("exportScale")]
        public float ExportScale = 1f;
    }

    [Serializable]
    public class SizeData
    {
        [JsonProperty("w")]
        public float W;

        [JsonProperty("h")]
        public float H;
    }

    [Serializable]
    public class ElementData
    {
        [JsonProperty("id")]
        public string Id;

        [JsonProperty("name")]
        public string Name;

        [JsonProperty("figmaType")]
        public string FigmaType;

        [JsonProperty("parentId")]
        public string ParentId;

        [JsonProperty("rect")]
        public RectData Rect;

        [JsonProperty("unity")]
        public UnityTransformData Unity;

        [JsonProperty("components")]
        public List<string> Components;

        [JsonProperty("style")]
        public StyleData Style;

        [JsonProperty("text")]
        public TextPropsData Text;

        [JsonProperty("asset")]
        public string Asset;

        [JsonProperty("assetBounds")]
        public AssetBoundsData AssetBounds;

        [JsonProperty("interactive")]
        public bool Interactive;

        [JsonProperty("children")]
        public List<string> Children;

        [JsonProperty("merged")]
        public bool Merged;

        [JsonProperty("exportable")]
        public bool Exportable;

        [JsonProperty("autoLayout")]
        public AutoLayoutData AutoLayout;

        [JsonProperty("nineSlice")]
        public NineSliceData NineSlice;

        [JsonProperty("clipsContent")]
        public bool ClipsContent;

        [JsonProperty("tokens")]
        public TokenBindingsData Tokens;
    }

    [Serializable]
    public class TokenRef
    {
        [JsonProperty("id")]
        public string Id;

        [JsonProperty("name")]
        public string Name;

        [JsonProperty("collection")]
        public string Collection;

        /// <summary>
        /// Resolved value from Figma.
        /// COLOR tokens → float[4] (RGBA 0-1).
        /// Scalar tokens (radius, opacity) → float[1].
        /// Use IsColor to distinguish.
        /// </summary>
        [JsonProperty("value")]
        [JsonConverter(typeof(TokenValueConverter))]
        public float[] Value;

        /// <summary>
        /// Present when the paint is a gradient: "LINEAR" | "RADIAL" | "ANGULAR" | "DIAMOND".
        /// Null for solid color tokens.
        /// </summary>
        [JsonProperty("gradientType")]
        public string GradientType;

        /// <summary>
        /// Full list of gradient stops (position + color + optional token name).
        /// Only present when GradientType is set.
        /// </summary>
        [JsonProperty("gradientStops")]
        public List<GradientStopData> GradientStops;

        public bool IsColor => Value != null && Value.Length == 4;
        public bool IsGradient => !string.IsNullOrEmpty(GradientType);

        public UnityEngine.Color ToColor()
            => IsColor ? new UnityEngine.Color(Value[0], Value[1], Value[2], Value[3])
                       : UnityEngine.Color.white;

        public float ToFloat() => Value != null && Value.Length > 0 ? Value[0] : 0f;
    }

    /// <summary>
    /// Deserializes token value which can be either a JSON number or a JSON array.
    /// number → float[1], array → float[]
    /// </summary>
    public class TokenValueConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType) => objectType == typeof(float[]);

        public override object ReadJson(JsonReader reader, Type objectType,
            object existingValue, JsonSerializer serializer)
        {
            var token = JToken.Load(reader);
            if (token.Type == JTokenType.Array)
                return token.ToObject<float[]>();
            if (token.Type == JTokenType.Float || token.Type == JTokenType.Integer)
                return new float[] { token.ToObject<float>() };
            return null;
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
            => serializer.Serialize(writer, value);
    }

    [Serializable]
    public class GradientStopData
    {
        /// <summary>Position along the gradient, 0–1.</summary>
        [JsonProperty("position")]
        public float Position;

        /// <summary>Resolved RGBA color of this stop (0–1 range).</summary>
        [JsonProperty("color")]
        public float[] Color;

        /// <summary>Name of the bound design token for this stop, if any.</summary>
        [JsonProperty("tokenName")]
        public string TokenName;

        public UnityEngine.Color ToColor()
            => Color != null && Color.Length >= 4
               ? new UnityEngine.Color(Color[0], Color[1], Color[2], Color[3])
               : UnityEngine.Color.white;
    }

    [Serializable]
    public class TokenBindingsData
    {
        [JsonProperty("fill")]
        public TokenRef Fill;

        [JsonProperty("stroke")]
        public StrokeTokenRef Stroke;

        [JsonProperty("cornerRadius")]
        public TokenRef CornerRadius;
    }

    /// <summary>
    /// Stroke token: color + thickness.
    /// </summary>
    [Serializable]
    public class StrokeTokenRef : TokenRef
    {
        /// <summary>Stroke thickness in Figma points.</summary>
        [JsonProperty("weight")]
        public float Weight;

        /// <summary>Name of the bound variable for strokeWeight, e.g. "Stroke/str-2". Null if not tokenised.</summary>
        [JsonProperty("weightTokenName")]
        public string WeightTokenName;
    }

    [Serializable]
    public class AssetBoundsData
    {
        [JsonProperty("x")]
        public float X;

        [JsonProperty("y")]
        public float Y;

        [JsonProperty("w")]
        public float W;

        [JsonProperty("h")]
        public float H;

        [JsonProperty("pixelWidth")]
        public int PixelWidth;

        [JsonProperty("pixelHeight")]
        public int PixelHeight;

        [JsonProperty("exportScale")]
        public float ExportScale;
    }

    [Serializable]
    public class AutoLayoutData
    {
        [JsonProperty("layoutMode")]
        public string LayoutMode;

        [JsonProperty("paddingTop")]
        public float PaddingTop;

        [JsonProperty("paddingBottom")]
        public float PaddingBottom;

        [JsonProperty("paddingLeft")]
        public float PaddingLeft;

        [JsonProperty("paddingRight")]
        public float PaddingRight;

        [JsonProperty("itemSpacing")]
        public float ItemSpacing;

        [JsonProperty("primaryAxisAlignItems")]
        public string PrimaryAxisAlignItems;

        [JsonProperty("counterAxisAlignItems")]
        public string CounterAxisAlignItems;
    }

    [Serializable]
    public class NineSliceData
    {
        [JsonProperty("border")]
        public float[] Border; // [left, bottom, right, top]

        [JsonProperty("exportScale")]
        public float ExportScale;
    }

    [Serializable]
    public class RectData
    {
        [JsonProperty("x")]
        public float X;

        [JsonProperty("y")]
        public float Y;

        [JsonProperty("w")]
        public float W;

        [JsonProperty("h")]
        public float H;
    }

    [Serializable]
    public class UnityTransformData
    {
        [JsonProperty("anchorMin")]
        public float[] AnchorMin;

        [JsonProperty("anchorMax")]
        public float[] AnchorMax;

        [JsonProperty("pivot")]
        public float[] Pivot;

        [JsonProperty("sizeDelta")]
        public float[] SizeDelta;

        [JsonProperty("offsetMin")]
        public float[] OffsetMin;

        [JsonProperty("offsetMax")]
        public float[] OffsetMax;

        [JsonProperty("localScale")]
        public float[] LocalScale;
    }

    [Serializable]
    public class StyleData
    {
        [JsonProperty("fill")]
        public float[] Fill;

        [JsonProperty("cornerRadius")]
        public float CornerRadius;

        [JsonProperty("opacity")]
        public float Opacity = 1f;

        [JsonProperty("stroke")]
        public StrokeStyleData Stroke;

        [JsonProperty("shadow")]
        public ShadowData Shadow;
    }

    [Serializable]
    public class StrokeStyleData
    {
        [JsonProperty("color")]
        public float[] Color;

        [JsonProperty("weight")]
        public float Weight;

        /// <summary>"INSIDE" | "OUTSIDE" | "CENTER"</summary>
        [JsonProperty("align")]
        public string Align;
    }

    [Serializable]
    public class ShadowData
    {
        [JsonProperty("x")]
        public float X;

        [JsonProperty("y")]
        public float Y;

        [JsonProperty("blur")]
        public float Blur;

        [JsonProperty("color")]
        public float[] Color;
    }

    [Serializable]
    public class TextPropsData
    {
        [JsonProperty("content")]
        public string Content;

        [JsonProperty("fontFamily")]
        public string FontFamily;

        [JsonProperty("fontStyle")]
        public string FontStyle;

        [JsonProperty("fontSize")]
        public float FontSize;

        [JsonProperty("color")]
        public float[] Color;

        [JsonProperty("alignment")]
        public string Alignment;

        [JsonProperty("lineHeight")]
        public float? LineHeight;

        [JsonProperty("letterSpacing")]
        public float? LetterSpacing;
    }

    [Serializable]
    public class AssetEntryData
    {
        [JsonProperty("file")]
        public string File;

        [JsonProperty("nodeId")]
        public string NodeId;

        [JsonProperty("scale")]
        public float Scale;
    }

    [Serializable]
    public class FontEntryData
    {
        [JsonProperty("family")]
        public string Family;

        [JsonProperty("styles")]
        public List<string> Styles;
    }
}
