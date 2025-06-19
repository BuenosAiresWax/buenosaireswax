export default function Notificacion({ mensaje, visible }) {
    if (!visible) return null;
    return (
        <div className="stock-aviso">
            {mensaje}
        </div>
    );
}
