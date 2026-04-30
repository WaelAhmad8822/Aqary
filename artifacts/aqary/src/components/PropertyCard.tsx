import React from "react";
import axios from "axios";

export default function PropertyCard({ property }: { property: any }) {
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function askProperty(question: string) {
    setLoading(true);
    try {
      const res = await axios.post("/api/chat/property-query", {
        propertyId: property.id,
        question,
      });
      setAnswer(res.data.answer || "لا توجد معلومات إضافية.");
    } catch (err: any) {
      setAnswer("حدث خطأ أثناء الاستعلام");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="property-card">
      <img src={property.thumbnail || "/placeholder.png"} alt={property.title} style={{ width: 240, height: 160, objectFit: "cover" }} />
      <h3>{property.title}</h3>
      <p>{property.location} — {property.price} AED</p>
      <div className="badges">
        {property.matchReasons?.map((r: string) => (
          <span key={r} className="badge">{r}</span>
        ))}
        {property.pricePerSqm ? <span className="badge">{property.pricePerSqm} AED/m²</span> : null}
        {property.daysOnMarket != null ? <span className="badge">{property.daysOnMarket} days</span> : null}
      </div>

      <p className="explanation">{property.explanation}</p>

      <div>
        <button onClick={() => askProperty("هل يوجد موقف سيارات خاص؟")} disabled={loading}>اسأل عن الموقف</button>
        <button onClick={() => askProperty("هل السعر نهائي أم قابل للتفاوض؟")} disabled={loading}>اسأل عن السعر</button>
      </div>

      {answer ? (
        <div className="property-answer">
          <strong>إجابة:</strong>
          <p>{answer}</p>
        </div>
      ) : null}
    </div>
  );
}
