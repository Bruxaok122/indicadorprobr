import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// Curated emoji set with searchable keywords (PT-BR)
const EMOJI_DATA: { e: string; k: string }[] = [
  // Smileys
  { e: "😀", k: "feliz sorriso grin" }, { e: "😃", k: "feliz sorriso" }, { e: "😄", k: "feliz" },
  { e: "😁", k: "sorriso" }, { e: "😆", k: "rindo" }, { e: "😅", k: "suor riso" },
  { e: "🤣", k: "rindo chao lol" }, { e: "😂", k: "chorando rir lol" }, { e: "🙂", k: "sorriso leve" },
  { e: "🙃", k: "invertido" }, { e: "😉", k: "piscar" }, { e: "😊", k: "feliz timido" },
  { e: "😇", k: "anjo" }, { e: "🥰", k: "amor coracoes" }, { e: "😍", k: "amor olhos" },
  { e: "🤩", k: "estrelas uau" }, { e: "😘", k: "beijo" }, { e: "😗", k: "beijo" },
  { e: "😚", k: "beijo" }, { e: "😙", k: "beijo" }, { e: "🥲", k: "lagrima sorriso" },
  { e: "😋", k: "delicioso lingua" }, { e: "😛", k: "lingua" }, { e: "😜", k: "lingua piscar" },
  { e: "🤪", k: "doido" }, { e: "😝", k: "lingua" }, { e: "🤑", k: "dinheiro" },
  { e: "🤗", k: "abraco" }, { e: "🤭", k: "ops" }, { e: "🤫", k: "silencio" },
  { e: "🤔", k: "pensando" }, { e: "🤐", k: "ziper boca" }, { e: "🤨", k: "duvida sobrancelha" },
  { e: "😐", k: "neutro" }, { e: "😑", k: "sem expressao" }, { e: "😶", k: "sem boca" },
  { e: "😏", k: "malicioso" }, { e: "😒", k: "tedio" }, { e: "🙄", k: "olhos revirando" },
  { e: "😬", k: "constrangido" }, { e: "🤥", k: "mentira pinoquio" }, { e: "😌", k: "aliviado" },
  { e: "😔", k: "pensativo triste" }, { e: "😪", k: "sono" }, { e: "🤤", k: "baba" },
  { e: "😴", k: "dormindo" }, { e: "😷", k: "mascara" }, { e: "🤒", k: "doente" },
  { e: "🤕", k: "machucado" }, { e: "🤢", k: "nausea" }, { e: "🤮", k: "vomito" },
  { e: "🤧", k: "espirro" }, { e: "🥵", k: "calor" }, { e: "🥶", k: "frio" },
  { e: "🥴", k: "tonto" }, { e: "😵", k: "tonto" }, { e: "🤯", k: "explodindo cabeca" },
  { e: "🤠", k: "cowboy" }, { e: "🥳", k: "festa" }, { e: "😎", k: "oculos legal" },
  { e: "🤓", k: "nerd" }, { e: "🧐", k: "monoculo" }, { e: "😕", k: "confuso" },
  { e: "😟", k: "preocupado" }, { e: "🙁", k: "triste leve" }, { e: "☹️", k: "triste" },
  { e: "😮", k: "surpreso" }, { e: "😯", k: "surpreso" }, { e: "😲", k: "chocado" },
  { e: "😳", k: "vermelho envergonhado" }, { e: "🥺", k: "suplica" }, { e: "😦", k: "frustrado" },
  { e: "😧", k: "angustia" }, { e: "😨", k: "medo" }, { e: "😰", k: "ansioso" },
  { e: "😥", k: "decepcionado" }, { e: "😢", k: "chorando triste" }, { e: "😭", k: "chorando muito" },
  { e: "😱", k: "grito medo" }, { e: "😖", k: "confuso" }, { e: "😣", k: "perseverando" },
  { e: "😞", k: "decepcionado" }, { e: "😓", k: "suor" }, { e: "😩", k: "cansado" },
  { e: "😫", k: "cansado" }, { e: "🥱", k: "bocejo" }, { e: "😤", k: "bravo vapor" },
  { e: "😡", k: "raiva bravo" }, { e: "😠", k: "bravo" }, { e: "🤬", k: "xingar" },
  { e: "😈", k: "diabo" }, { e: "👿", k: "diabo bravo" }, { e: "💀", k: "caveira morto" },
  { e: "☠️", k: "caveira" }, { e: "💩", k: "coco" }, { e: "🤡", k: "palhaco" },
  { e: "👻", k: "fantasma" }, { e: "👽", k: "alien" }, { e: "🤖", k: "robo" },
  // Gestures / hands
  { e: "👍", k: "joia legal positivo" }, { e: "👎", k: "negativo ruim" }, { e: "👌", k: "ok" },
  { e: "✌️", k: "paz vitoria" }, { e: "🤞", k: "torcendo" }, { e: "🤟", k: "amor rock" },
  { e: "🤘", k: "rock" }, { e: "🤙", k: "ligar" }, { e: "👈", k: "esquerda" },
  { e: "👉", k: "direita" }, { e: "👆", k: "cima" }, { e: "👇", k: "baixo" },
  { e: "☝️", k: "indicador" }, { e: "✋", k: "mao parar" }, { e: "🤚", k: "mao" },
  { e: "🖐️", k: "mao aberta" }, { e: "🖖", k: "vulcano" }, { e: "👋", k: "tchau ola aceno" },
  { e: "🤝", k: "aperto mao" }, { e: "👏", k: "palmas aplauso" }, { e: "🙌", k: "comemorar" },
  { e: "👐", k: "maos abertas" }, { e: "🤲", k: "maos juntas" }, { e: "🙏", k: "obrigado oracao por favor" },
  { e: "💪", k: "forte musculo" }, { e: "🦾", k: "braco mecanico" }, { e: "✍️", k: "escrever" },
  // Hearts
  { e: "❤️", k: "coracao amor vermelho" }, { e: "🧡", k: "coracao laranja" }, { e: "💛", k: "coracao amarelo" },
  { e: "💚", k: "coracao verde" }, { e: "💙", k: "coracao azul" }, { e: "💜", k: "coracao roxo" },
  { e: "🖤", k: "coracao preto" }, { e: "🤍", k: "coracao branco" }, { e: "🤎", k: "coracao marrom" },
  { e: "💔", k: "coracao partido" }, { e: "❣️", k: "coracao exclamacao" }, { e: "💕", k: "coracoes amor" },
  { e: "💞", k: "coracoes" }, { e: "💓", k: "batendo coracao" }, { e: "💗", k: "crescendo coracao" },
  { e: "💖", k: "brilhando coracao" }, { e: "💘", k: "flecha coracao" }, { e: "💝", k: "presente coracao" },
  // Symbols / objects
  { e: "🔥", k: "fogo" }, { e: "💥", k: "explosao" }, { e: "✨", k: "brilho estrelas" },
  { e: "⭐", k: "estrela" }, { e: "🌟", k: "estrela brilho" }, { e: "💫", k: "tontura estrela" },
  { e: "💯", k: "cem 100" }, { e: "✅", k: "check certo confirmado" }, { e: "❌", k: "errado x" },
  { e: "⚠️", k: "atencao alerta" }, { e: "❗", k: "exclamacao" }, { e: "❓", k: "interrogacao" },
  { e: "🎉", k: "festa comemorar" }, { e: "🎊", k: "festa confete" }, { e: "🎈", k: "balao" },
  { e: "🎁", k: "presente" }, { e: "🏆", k: "trofeu" }, { e: "🥇", k: "medalha ouro" },
  { e: "💰", k: "dinheiro saco" }, { e: "💵", k: "dolar dinheiro" }, { e: "💸", k: "dinheiro voando" },
  { e: "💳", k: "cartao" }, { e: "📞", k: "telefone" }, { e: "📱", k: "celular" },
  { e: "💬", k: "mensagem balao" }, { e: "📩", k: "email mensagem" }, { e: "📌", k: "pin" },
  { e: "📍", k: "local pin" }, { e: "⏰", k: "alarme relogio" }, { e: "⏳", k: "ampulheta" },
  { e: "☀️", k: "sol" }, { e: "🌙", k: "lua" }, { e: "⚡", k: "raio" },
  { e: "☕", k: "cafe" }, { e: "🍻", k: "cerveja brinde" }, { e: "🥂", k: "brinde tacas" },
  { e: "🍕", k: "pizza" }, { e: "🍔", k: "hamburguer" }, { e: "🎵", k: "musica nota" },
  { e: "🎶", k: "musica notas" }, { e: "📷", k: "camera foto" }, { e: "📸", k: "camera flash" },
  { e: "🚀", k: "foguete" }, { e: "🏁", k: "bandeira chegada" }, { e: "🌹", k: "rosa flor" },
  { e: "🌸", k: "flor cereja" }, { e: "🌻", k: "girassol" }, { e: "🍀", k: "trevo sorte" },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMOJI_DATA;
    return EMOJI_DATA.filter((it) => it.k.includes(q) || it.e.includes(q));
  }, [query]);

  return (
    <div className="w-[280px]">
      <Input
        autoFocus
        placeholder="Buscar emoji..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 text-sm mb-2"
      />
      <ScrollArea className="h-[220px]">
        {filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            Nenhum emoji encontrado
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1 pr-2">
            {filtered.map((it, i) => (
              <button
                key={`${it.e}-${i}`}
                onClick={() => onSelect(it.e)}
                className="text-xl hover:bg-accent rounded p-1 transition-colors"
                title={it.k}
              >
                {it.e}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
