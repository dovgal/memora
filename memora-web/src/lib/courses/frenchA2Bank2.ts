// Банк заданий A2 — БЛОК 2 (~200 вопросов, id 400+). Вместе с frenchA2Bank.ts и
// диагностикой даёт пул 400+. Контент авторский по программе A2 (CEFR).

import { A2Question } from "./frenchA2";

function mc(id: number, unit: number, gp: string, prompt: string, options: string[], answerIndex: number, speak: string, explanation: string, skill: A2Question["skill"] = "grammar"): A2Question {
  return { id, unit, skill, grammarPoint: gp, type: "mc", prompt, options, answerIndex, speak, explanation };
}
function tx(id: number, unit: number, gp: string, prompt: string, accept: string[], speak: string, explanation: string, skill: A2Question["skill"] = "grammar"): A2Question {
  return { id, unit, skill, grammarPoint: gp, type: "text", prompt, accept, speak, explanation };
}

export const A2_BANK2: A2Question[] = [
  // ════ PASSÉ COMPOSÉ — углубление (U1) ════
  mc(400, 1, "Passé composé", "Hier, elles ____ au théâtre.", ["ont allé", "sont allées", "sont allé", "allaient"], 1, "Hier, elles sont allées au théâtre.", "aller с être, согласование ж.р. мн.ч. → allées."),
  mc(401, 1, "Passé composé", "Nous ____ nos amis samedi.", ["avons vu", "sommes vus", "avons vus", "voyons"], 0, "Nous avons vu nos amis samedi.", "voir с avoir, без согласования с подлежащим → vu."),
  tx(402, 1, "Passé composé", "Поставьте: « Je (descendre) au sous-sol. »", ["je suis descendu", "je suis descendue"], "Je suis descendu au sous-sol.", "descendre (движение) с être → descendu."),
  mc(403, 1, "Participe passé", "Participe passé глагола « dire »:", ["dit", "disé", "dis", "d246u"], 0, "dit", "dire → dit."),
  mc(404, 1, "Participe passé", "Participe passé глагола « venir »:", ["venu", "veni", "venait", "vené"], 0, "venu", "venir → venu."),
  mc(405, 1, "Participe passé", "Participe passé глагола « écrire »:", ["écrivé", "écrit", "écris", "écrivu"], 1, "écrit", "écrire → écrit."),
  tx(406, 1, "Passé composé (pronominal)", "Поставьте: « Elles (se promener) au parc. »", ["elles se sont promenées"], "Elles se sont promenées au parc.", "Возвратный → être, ж.р. мн.ч. → promenées."),
  mc(407, 1, "Passé composé (négation)", "Forme négative: « Il est parti. »", ["Il n'est pas parti", "Il est pas parti", "Il ne parti pas", "Il n'a pas parti"], 0, "Il n'est pas parti.", "ne...pas вокруг être."),

  // ════ IMPARFAIT — углубление (U2) ════
  mc(408, 2, "Imparfait", "Avant, il ____ tous les jours.", ["court", "courait", "a couru", "courra"], 1, "Avant, il courait tous les jours.", "Привычка → imparfait: courait."),
  tx(409, 2, "Imparfait", "Imparfait (je) глагола faire: « Je ___ du sport. »", ["je faisais", "faisais"], "Je faisais du sport.", "faire → faisais."),
  mc(410, 2, "Imparfait vs PC", "Nous regardions un film quand l'orage ____.", ["éclatait", "a éclaté", "éclate", "éclatera"], 1, "Nous regardions un film quand l'orage a éclaté.", "Внезапное событие → passé composé."),
  mc(411, 2, "Imparfait (description)", "La maison ____ vieille et sombre.", ["est", "était", "a été", "sera"], 1, "La maison était vieille et sombre.", "Описание → imparfait: était."),
  tx(412, 2, "Imparfait", "Imparfait (ils): « Ils (finir) toujours tard. »", ["ils finissaient"], "Ils finissaient toujours tard.", "finir → finissaient (основа finiss-)."),
  mc(413, 2, "Imparfait vs PC", "Quand je suis arrivé, il ____ déjà.", ["dormait", "a dormi", "dort", "dormira"], 0, "Quand je suis arrivé, il dormait déjà.", "Состояние-фон → imparfait."),

  // ════ Y / EN / pronoms (U3, U7) ════
  mc(414, 3, "Pronom EN", "Vous avez assez de pain ? — Oui, nous ____ avons assez.", ["y", "en", "le", "des"], 1, "Nous en avons assez.", "de pain → en."),
  mc(415, 3, "Pronom Y", "Il pense à son voyage ? — Oui, il ____ pense.", ["en", "y", "lui", "le"], 1, "Il y pense.", "penser à qqch → y."),
  tx(416, 3, "Pronom EN", "Замените: « Je veux trois pommes. » → « J'____ veux trois. »", ["en", "j'en veux trois"], "J'en veux trois.", "Количество → en."),
  mc(417, 7, "Double pronom", "Tu me prêtes ton stylo ? — Oui, je ____ prête.", ["te le", "le te", "te lui", "lui le"], 0, "Je te le prête.", "te (COI) + le (COD) → te le."),
  mc(418, 7, "Pronom (y + verbe)", "Tu réfléchis à la question ? — J'____ réfléchis.", ["en", "y", "la", "lui"], 1, "J'y réfléchis.", "réfléchir à → y."),

  // ════ COMPARATIF / SUPERLATIF / RELATIFS (U4) ════
  mc(419, 4, "Comparatif", "Cette voiture est ____ rapide que l'autre. (=)", ["plus", "moins", "aussi", "autant"], 2, "Cette voiture est aussi rapide que l'autre.", "Равенство с прилаг. → aussi ... que."),
  mc(420, 4, "Comparatif (mieux/meilleur)", "Aujourd'hui, je vais ____ qu'hier.", ["meilleur", "mieux", "plus bon", "plus bien"], 1, "Aujourd'hui, je vais mieux qu'hier.", "aller bien → mieux (наречие)."),
  mc(421, 4, "Superlatif", "C'est l'élève ____ travailleur de la classe.", ["plus", "le plus", "très", "moins de"], 1, "C'est l'élève le plus travailleur de la classe.", "Превосходная → le plus."),
  mc(422, 4, "Relatif dont", "Voici l'outil ____ j'ai besoin.", ["que", "qui", "dont", "où"], 2, "Voici l'outil dont j'ai besoin.", "avoir besoin de → dont."),
  tx(423, 4, "Relatif", "Вставьте qui/que: « Le gâteau ___ tu as fait est délicieux. »", ["que", "le gâteau que tu as fait est délicieux"], "Le gâteau que tu as fait est délicieux.", "Прямое дополнение → que."),
  mc(424, 4, "Comparatif (moins de)", "J'ai ____ travail que la semaine dernière.", ["moins de", "moins", "aussi", "plus que"], 0, "J'ai moins de travail que la semaine dernière.", "С существительным → moins de ... que."),

  // ════ FUTUR (U5) ════
  mc(425, 5, "Futur simple", "S'il fait beau, nous ____ à la plage.", ["allons", "irons", "allions", "irions"], 1, "Nous irons à la plage.", "aller в futur → irons."),
  tx(426, 5, "Futur simple", "Futur (tu): « Tu (finir) bientôt. »", ["tu finiras", "tu finiras bientôt"], "Tu finiras bientôt.", "finir → finiras."),
  mc(427, 5, "Futur simple (venir)", "Mes parents ____ me voir dimanche.", ["viennent", "viendront", "venaient", "viendraient"], 1, "Mes parents viendront me voir dimanche.", "venir в futur → viendront."),
  mc(428, 5, "Futur (pouvoir)", "Avec ce diplôme, tu ____ travailler partout.", ["peux", "pourras", "pouvais", "pourrais"], 1, "Tu pourras travailler partout.", "pouvoir в futur → pourras."),
  tx(429, 5, "Futur (devoir)", "Futur (nous): « Nous (devoir) partir tôt. »", ["nous devrons", "nous devrons partir tôt"], "Nous devrons partir tôt.", "devoir в futur → devrons."),
  mc(430, 5, "Futur proche", "Attention ! Tu ____ tomber.", ["vas", "iras", "allais", "es allé"], 0, "Tu vas tomber.", "Неминуемое → futur proche."),

  // ════ PARTITIFS / IMPÉRATIF (U6) ════
  mc(431, 6, "Partitif", "Pour le gâteau, il faut ____ sucre.", ["de la", "du", "des", "le"], 1, "Il faut du sucre.", "sucre — м.р. → du."),
  mc(432, 6, "Partitif (négation)", "Désolé, je n'ai pas ____ monnaie.", ["de la", "du", "de", "des"], 2, "Je n'ai pas de monnaie.", "После отрицания → de."),
  mc(433, 6, "Quantité", "Je voudrais une bouteille ____ eau.", ["de l'", "d'", "de la", "du"], 1, "Une bouteille d'eau.", "После количества → de/d' перед гласной."),
  tx(434, 6, "Impératif", "Impératif (nous) глагола manger: « ___ ensemble ! »", ["mangeons", "mangeons ensemble"], "Mangeons ensemble !", "manger (nous) → mangeons."),
  mc(435, 6, "Impératif (avoir)", "____ confiance en toi !", ["As", "Aie", " Has", "Ait"], 1, "Aie confiance en toi !", "Императив avoir (tu): aie."),
  tx(436, 6, "Impératif (négatif)", "Сделайте отрицательным (tu): « Mange ça ! » →", ["ne mange pas ça"], "Ne mange pas ça !", "Отрицательный императив: ne mange pas."),

  // ════ COD/COI/DISCOURS (U7, U8) ════
  mc(437, 7, "COD passé (accord)", "Les photos ? Je les ai ____.", ["pris", "prises", "prise", "prendre"], 1, "Je les ai prises.", "COD перед глаголом → согласование: prises."),
  mc(438, 7, "COI", "Je téléphone à mon frère → Je ____ téléphone.", ["le", "lui", "la", "y"], 1, "Je lui téléphone.", "téléphoner à qqn → lui."),
  tx(439, 7, "COD", "Замените: « J'aime ce film. » → « Je ___ aime. »", ["l'", "je l'aime"], "Je l'aime.", "ce film → l' (перед гласной)."),
  mc(440, 8, "Discours indirect", "Elle dit : « Je suis prête. » → Elle dit qu'elle ____ prête.", ["es", "est", "suis", "était"], 1, "Elle dit qu'elle est prête.", "Косвенная речь, 3 л. → est."),
  mc(441, 8, "Négation (rien)", "Je n'ai ____ acheté au marché.", ["pas", "rien", "personne", "jamais"], 1, "Je n'ai rien acheté.", "ne...rien в passé: n'ai rien acheté."),
  tx(442, 8, "Négation (personne)", "Переведите: « Я никого не видел. »", ["je n'ai vu personne"], "Je n'ai vu personne.", "ne...personne: personne идёт после причастия."),
  mc(443, 8, "Négation (ne...que)", "Il ____ reste ____ deux jours. (только)", ["ne / que", "ne / pas", "n' / plus", "ne / rien"], 0, "Il ne reste que deux jours.", "ne...que = только."),

  // ════ ÉQUIVALENCE / SUBJONCTIF (U9, U12) ════
  mc(444, 9, "Équivalence", "Elle gagne ____ d'argent que lui.", ["aussi", "autant", "plus que", "moins"], 1, "Elle gagne autant d'argent que lui.", "С существительным → autant de ... que."),
  mc(445, 9, "Il faut que (subj)", "Il faut que vous ____ patients.", ["êtes", "soyez", "serez", "étiez"], 1, "Il faut que vous soyez patients.", "il faut que → subjonctif: soyez."),
  tx(446, 12, "Subjonctif", "Subjonctif (que nous) глагола faire: « ... que nous ___. »", ["fassions", "que nous fassions"], "que nous fassions", "faire → que nous fassions."),
  mc(447, 12, "Subjonctif (vouloir)", "Je veux qu'il ____ rester.", ["veut", "veuille", "voudra", "voulait"], 1, "Je veux qu'il veuille rester.", "vouloir в subjonctif: veuille."),
  mc(448, 12, "Subjonctif (savoir)", "Il faut que tu ____ la vérité.", ["sais", "saches", "sauras", "savais"], 1, "Il faut que tu saches la vérité.", "savoir в subjonctif: saches."),
  tx(449, 12, "Superlatif", "Переведите: « Это лучшее решение. »", ["c'est la meilleure solution", "c'est la meilleure décision"], "C'est la meilleure solution.", "bon → la meilleure."),

  // ════ GÉRONDIF / PRÉPOSITIONS (U10) ════
  mc(450, 10, "Gérondif", "Elle s'est endormie ____ (lire).", ["en lisant", "lisant", "à lire", "de lire"], 0, "Elle s'est endormie en lisant.", "Одновременность → en lisant."),
  tx(451, 10, "Gérondif", "Образуйте gérondif от « commencer »:", ["en commençant"], "en commençant", "commencer → en commençant (ç перед a)."),
  mc(452, 10, "Prépositions pays", "Je rêve d'aller ____ Canada.", ["en", "au", "à", "aux"], 1, "d'aller au Canada", "Страна м.р. → au."),
  mc(453, 10, "Prépositions pays", "Ma cousine habite ____ Allemagne.", ["au", "en", "à", "aux"], 1, "en Allemagne", "Страна ж.р. → en."),
  mc(454, 10, "Prépositions (venir de)", "Je viens ____ Portugal.", ["de", "du", "des", "d'"], 1, "Je viens du Portugal.", "Из страны м.р. → du."),

  // ════ DÉMONSTRATIFS / POSSESSIFS (U11) ════
  mc(455, 11, "Démonstratif", "Quel manteau ? — ____ -là, le noir.", ["Celui", "Celle", "Ceux", "Ce"], 0, "Celui-là, le noir.", "manteau — м.р. → celui."),
  mc(456, 11, "Démonstratif", "Quelles fleurs ? — ____ que tu préfères.", ["Celui", "Celle", "Celles", "Ceux"], 2, "Celles que tu préfères.", "fleurs — ж.р. мн.ч. → celles."),
  mc(457, 11, "Possessif", "C'est votre voiture ? — Non, ce n'est pas ____.", ["le nôtre", "la nôtre", "les nôtres", "notre"], 1, "Ce n'est pas la nôtre.", "voiture ж.р. → la nôtre."),
  tx(458, 11, "Possessif", "Замените: « Ce sont ses livres. » → « Ce sont ___. »", ["les siens"], "Ce sont les siens.", "livres м.р. мн.ч., его → les siens."),

  // ════ ЛЕКСИКА В КОНТЕКСТЕ — фразы (разные юниты) ════
  mc(459, 1, "Lexique", "« prendre une décision » означает:", ["принять решение", "опоздать", "переехать", "отдохнуть"], 0, "prendre une décision", "prendre une décision = принять решение."),
  mc(460, 3, "Lexique logement", "« Je cherche un studio meublé. » — что ищут?", ["меблированную студию", "пустую квартиру", "дом за городом", "офис"], 0, "un studio meublé", "meublé = меблированный."),
  mc(461, 5, "Lexique futur", "« la voiture autonome » это:", ["беспилотный автомобиль", "электромобиль", "гоночная машина", "грузовик"], 0, "la voiture autonome", "autonome = самоуправляемый."),
  mc(462, 7, "Lexique santé", "« Je dois prendre ce médicament deux fois par jour. » Как часто?", ["дважды в день", "раз в неделю", "каждый час", "перед сном"], 0, "deux fois par jour", "deux fois par jour = дважды в день."),
  mc(463, 8, "Lexique médias", "« regarder un journal télévisé » означает:", ["смотреть выпуск новостей", "читать газету", "слушать радио", "смотреть фильм"], 0, "un journal télévisé", "journal télévisé = телевыпуск новостей."),
  tx(464, 9, "Lexique écologie", "Переведите: « сортировать отходы »", ["trier les déchets"], "trier les déchets", "trier = сортировать, déchets = отходы."),
  mc(465, 10, "Lexique voyage", "« faire ses valises » означает:", ["собирать чемоданы", "покупать билеты", "бронировать отель", "опаздывать на рейс"], 0, "faire ses valises", "faire ses valises = собирать вещи."),
  mc(466, 11, "Lexique travail", "« travailler à temps partiel » означает:", ["работать неполный день", "работать сверхурочно", "работать из дома", "не работать"], 0, "à temps partiel", "à temps partiel = неполный рабочий день."),
  mc(467, 12, "Lexique nature", "« une espèce en voie de disparition » это:", ["вымирающий вид", "новый вид", "домашнее животное", "растение"], 0, "espèce en voie de disparition", "en voie de disparition = под угрозой исчезновения."),

  // ════ АУДИРОВАНИЕ (listening) ════
  tx(468, 1, "Compréhension orale", "🔊 Запишите услышанное:", ["je me suis levé tôt ce matin", "je me suis levée tôt ce matin"], "Je me suis levé tôt ce matin.", "Возвратный passé composé."),
  mc(469, 4, "Compréhension orale", "🔊 Что прозвучало?", ["Il est plus âgé que moi.", "Il est moins âgé que moi.", "Il est aussi âgé que moi.", "Il est très âgé."], 0, "Il est plus âgé que moi.", "Сравнение plus...que."),
  tx(470, 6, "Compréhension orale", "🔊 Запишите рецепт:", ["coupez les légumes en petits morceaux"], "Coupez les légumes en petits morceaux.", "Императив (vous): coupez."),
  tx(471, 9, "Compréhension orale", "🔊 Запишите:", ["il faut économiser l'eau et l'électricité"], "Il faut économiser l'eau et l'électricité.", "il faut + инфинитив."),
  mc(472, 11, "Compréhension orale", "🔊 Что прозвучало?", ["J'ai trouvé un nouveau travail.", "Je cherche un travail.", "J'ai perdu mon travail.", "Je vais au travail."], 0, "J'ai trouvé un nouveau travail.", "Passé composé: ai trouvé."),
  tx(473, 12, "Compréhension orale", "🔊 Запишите:", ["nous devons protéger la planète"], "Nous devons protéger la planète.", "devoir + инфинитив."),

  // ════ ГОВОРЕНИЕ (speaking) ════
  tx(474, 1, "Production orale", "🎙 Расскажите о вчерашнем дне (passé composé, 1 фраза):", ["hier j'ai travaillé toute la journée", "hier j'ai étudié le français"], "Hier, j'ai travaillé toute la journée.", "Тренировка passé composé в речи."),
  tx(475, 5, "Production orale", "🎙 Скажите о планах (futur, 1 фраза):", ["l'année prochaine je voyagerai", "demain je travaillerai"], "L'année prochaine, je voyagerai.", "Тренировка futur simple."),
  mc(476, 10, "Production orale", "🎙 Произнесите. Какой здесь gérondif?", ["en marchant", "marchant", "à marcher", "marché"], 0, "Je téléphone en marchant.", "Gérondif: en marchant."),

  // ════ ФОНЕТИКА / ОРФОГРАФИЯ ════
  mc(477, 2, "Homophones", "« Ils ___ partis. » (быть, passé composé)", ["son", "sont", "sons", "s'ont"], 1, "Ils sont partis.", "sont (être) vs son (его)."),
  mc(478, 8, "Homophones", "« ___ est ton avis ? » (какой)", ["Quel", "Quelle", "Quels", "Qu'elle"], 0, "Quel est ton avis ?", "quel (м.р.) vs qu'elle."),
  mc(479, 3, "Homophones (ou/où)", "Tu habites ____ ?", ["ou", "où", "oux", "hou"], 1, "Tu habites où ?", "où (где) vs ou (или)."),
  mc(480, 7, "Homophones (ces/ses)", "Il aime ____ enfants. (свои)", ["ces", "ses", "c'est", "sais"], 1, "Il aime ses enfants.", "ses (свои) vs ces (эти)."),
  tx(481, 5, "Orthographe (futur)", "Futur (je) глагола jeter: « Je ___ les vieux papiers. »", ["jetterai", "je jetterai"], "Je jetterai les vieux papiers.", "jeter удваивает t в futur: jetterai."),
  mc(482, 6, "Accents", "Правильное написание «уже готов»:", ["déja prêt", "déjà prêt", "deja prêt", "déjà pret"], 1, "déjà prêt", "déjà и prêt — с акцентами."),

  // ════ ЧИСЛА / ДАТА / ВРЕМЯ ════
  mc(483, 5, "Nombres", "« soixante-douze » это:", ["62", "72", "82", "92"], 1, "soixante-douze", "72 = soixante-douze."),
  tx(484, 5, "Nombres", "Напишите словами: « 81 »", ["quatre-vingt-un"], "quatre-vingt-un", "81 = quatre-vingt-un."),
  mc(485, 2, "Heure", "« Il est huit heures et quart » это:", ["8:15", "8:45", "8:30", "8:00"], 0, "Il est huit heures et quart.", "et quart = :15."),
  mc(486, 2, "Heure", "« midi et demi » это:", ["12:30", "00:30", "12:00", "11:30"], 0, "midi et demi", "12:30 — полдень с половиной."),

  // ════ ПРЕДЛОГИ / СВЯЗКИ ════
  mc(487, 5, "Prépositions temps", "Je suis ici ____ lundi. (с понедельника)", ["depuis", "pendant", "dans", "il y a"], 0, "depuis lundi", "depuis = с (точка отсчёта)."),
  mc(488, 5, "Prépositions temps", "J'ai vécu à Paris ____ cinq ans. (в течение)", ["depuis", "pendant", "dans", "en"], 1, "J'ai vécu à Paris pendant cinq ans.", "pendant = в течение (завершённый период)."),
  mc(489, 8, "Connecteurs", "Il pleut, ____ je prends un parapluie.", ["mais", "donc", "ou", "car"], 1, "Il pleut, donc je prends un parapluie.", "donc = следовательно (следствие)."),
  mc(490, 8, "Connecteurs", "Je reste à la maison ____ il pleut.", ["donc", "parce qu'", "mais", "ou"], 1, "Je reste à la maison parce qu'il pleut.", "parce que = потому что (причина)."),
  mc(491, 8, "Connecteurs", "Il est fatigué ____ il continue.", ["donc", "mais", "car", "alors"], 1, "Il est fatigué mais il continue.", "mais = но (противопоставление)."),

  // ════ ДОПОЛНИТЕЛЬНЫЕ ГЛАГОЛЫ / СПРЯЖЕНИЕ ════
  tx(492, 7, "Conjugaison (devoir)", "Présent (vous): « Vous ___ vous reposer. »", ["vous devez", "devez"], "Vous devez vous reposer.", "devoir: vous devez."),
  tx(493, 9, "Conjugaison (savoir)", "Présent (je): « Je ___ nager. »", ["je sais", "sais"], "Je sais nager.", "savoir: je sais."),
  mc(494, 6, "Conjugaison (prendre)", "Le matin, ils ____ le métro.", ["prendent", "prennent", "prend", "prenent"], 1, "Ils prennent le métro.", "prendre: ils prennent."),
  tx(495, 10, "Conjugaison (partir)", "Présent (nous): « Nous ___ demain. »", ["nous partons", "partons"], "Nous partons demain.", "partir: nous partons."),
  mc(496, 5, "Conjugaison (vouloir)", "Qu'est-ce que vous ____ boire ?", ["voulez", "voudrez", "vouliez", "veulent"], 0, "Qu'est-ce que vous voulez boire ?", "vouloir: vous voulez."),

  // ════ СИТУАТИВНЫЕ / КОММУНИКАТИВНЫЕ ════
  mc(497, 6, "Communication", "Au restaurant, pour demander le prix final, on dit :", ["L'addition, s'il vous plaît.", "Bon appétit !", "Santé !", "À table !"], 0, "L'addition, s'il vous plaît.", "Просьба счёта в ресторане."),
  mc(498, 3, "Communication", "Pour inviter un ami chez soi :", ["Tu veux venir chez moi ?", "Combien ça coûte ?", "Où est la gare ?", "Quelle heure est-il ?"], 0, "Tu veux venir chez moi ?", "Приглашение в гости."),
  mc(499, 7, "Communication", "Pour exprimer la douleur :", ["J'ai mal au dos.", "J'ai faim.", "J'ai soif.", "J'ai sommeil."], 0, "J'ai mal au dos.", "avoir mal à = испытывать боль."),
  tx(500, 1, "Communication", "Переведите: « Можно задать вопрос? »", ["est-ce que je peux poser une question", "je peux poser une question"], "Est-ce que je peux poser une question ?", "Вежливая просьба."),

  // ════ ЕЩЁ ГРАММАТИКА — закрепление слабых мест ════
  mc(501, 1, "Passé composé/imparfait", "Je marchais dans la rue quand j'____ un vieil ami.", ["rencontrais", "ai rencontré", "rencontre", "rencontrerai"], 1, "...quand j'ai rencontré un vieil ami.", "Событие на фоне → passé composé."),
  mc(502, 2, "Imparfait", "Il y ____ une fois un roi très riche.", ["avait", "a eu", "a", "aura"], 0, "Il y avait une fois un roi.", "Зачин рассказа → imparfait: il y avait."),
  tx(503, 12, "Subjonctif (être)", "Subjonctif (qu'ils): « Il faut qu'ils ___ à l'heure. »", ["soient", "qu'ils soient"], "Il faut qu'ils soient à l'heure.", "être → qu'ils soient."),
  mc(504, 4, "Relatif (ce qui/ce que)", "Dis-moi ____ tu veux.", ["ce qui", "ce que", "qui", "que"], 1, "Dis-moi ce que tu veux.", "ce que — то, что (дополнение)."),
  mc(505, 7, "Pronom (en + quantité)", "Des erreurs ? Tout le monde ____ fait.", ["les", "en", "y", "leur"], 1, "Tout le monde en fait.", "des erreurs → en."),
  tx(506, 10, "Gérondif", "Переведите: « Я завтракаю, читая газету. »", ["je prends le petit-déjeuner en lisant le journal", "je déjeune en lisant le journal"], "Je prends le petit-déjeuner en lisant le journal.", "Одновременность → en lisant."),
  mc(507, 9, "Comparatif (de plus en plus)", "Il fait ____ chaud chaque été. (всё более)", ["de plus en plus", "plus de plus", "très plus", "le plus"], 0, "Il fait de plus en plus chaud.", "de plus en plus = всё более и более."),
  mc(508, 11, "Pronom y", "Tu participes au concours ? — Oui, j'____ participe.", ["en", "y", "le", "lui"], 1, "J'y participe.", "participer à → y."),
  tx(509, 8, "Discours indirect", "Преобразуйте: « Il dit : “Je travaille.” » → « Il dit ___. »", ["qu'il travaille", "il dit qu'il travaille"], "Il dit qu'il travaille.", "Косвенная речь → que + 3 л."),
  mc(510, 6, "Article (de после adv. quantité)", "Il y a beaucoup ____ monde ici.", ["de", "du", "des", "de la"], 0, "beaucoup de monde", "beaucoup de + сущ."),

  // ════ БЛОК 3: добор до 400+ ════
  // Passé composé / imparfait — истории
  mc(511, 1, "Passé composé", "Le week-end dernier, j'____ mes grands-parents.", ["ai visité", "visite", "visitais", "visiterai"], 0, "J'ai visité mes grands-parents.", "Завершённое прошлое → ai visité."),
  mc(512, 1, "Passé composé (être)", "Le train ____ à l'heure.", ["a arrivé", "est arrivé", "arrivait", "arrivera"], 1, "Le train est arrivé à l'heure.", "arriver с être → est arrivé."),
  tx(513, 1, "Passé composé", "Поставьте: « Nous (recevoir) une lettre. »", ["nous avons reçu", "nous avons reçu une lettre"], "Nous avons reçu une lettre.", "recevoir → reçu."),
  mc(514, 1, "Participe passé", "Participe passé глагола « pouvoir »:", ["pu", "pouvu", "peux", "pouvé"], 0, "pu", "pouvoir → pu."),
  mc(515, 1, "Participe passé", "Participe passé глагола « vouloir »:", ["voulé", "voulu", "veut", "voulais"], 1, "voulu", "vouloir → voulu."),
  mc(516, 2, "Imparfait", "Chaque matin, elle ____ un café.", ["boit", "buvait", "a bu", "boira"], 1, "Chaque matin, elle buvait un café.", "Привычка → imparfait: buvait."),
  tx(517, 2, "Imparfait", "Imparfait (vous): « Vous (prendre) le bus. »", ["vous preniez"], "Vous preniez le bus.", "prendre → preniez (основа pren-)."),
  mc(518, 2, "Imparfait vs PC", "Pendant que je cuisinais, les enfants ____ (jouer).", ["jouaient", "ont joué", "jouent", "joueront"], 0, "...les enfants jouaient.", "Параллельные длительные действия → imparfait."),

  // Pronoms
  mc(519, 7, "COD", "Vous connaissez ce livre ? — Oui, je ____ connais.", ["lui", "le", "y", "en"], 1, "Je le connais.", "connaître qqch → le."),
  mc(520, 7, "COI", "Tu offres un cadeau à tes amis ? — Je ____ offre un cadeau.", ["les", "leur", "lui", "y"], 1, "Je leur offre un cadeau.", "offrir à (мн.ч.) → leur."),
  mc(521, 3, "Y", "Vous croyez à la chance ? — Oui, j'____ crois.", ["en", "y", "le", "lui"], 1, "J'y crois.", "croire à → y."),
  tx(522, 3, "EN", "Замените: « Je parle de mes vacances. » → « J'___ parle. »", ["en", "j'en parle"], "J'en parle.", "parler de → en."),
  mc(523, 7, "Double pronom", "Il donne les clés à Marie → Il ____ donne.", ["les lui", "lui les", "la lui", "les leur"], 0, "Il les lui donne.", "les (COD) + lui (COI)."),

  // Comparatif/superlatif/relatifs
  mc(524, 4, "Comparatif", "Le métro est ____ rapide que le bus.", ["plus", "moins", "aussi", "autant"], 0, "Le métro est plus rapide que le bus.", "Превосходство → plus ... que."),
  mc(525, 4, "Superlatif (mieux)", "C'est elle qui cuisine ____.", ["le mieux", "le meilleur", "la mieux", "plus bien"], 0, "C'est elle qui cuisine le mieux.", "Превосходная от bien → le mieux."),
  mc(526, 4, "Relatif", "La ville ____ je viens est petite.", ["que", "qui", "dont", "d'où"], 3, "La ville d'où je viens est petite.", "venir de un lieu → d'où."),
  tx(527, 4, "Relatif qui/que/où", "Вставьте: « Le moment ___ il est arrivé... »", ["où", "le moment où il est arrivé"], "Le moment où il est arrivé...", "où — для времени."),

  // Futur / hypothèse
  mc(528, 5, "Futur (si présent)", "Si tu travailles bien, tu ____ ton examen.", ["réussis", "réussiras", "réussissais", "réussirais"], 1, "...tu réussiras ton examen.", "Si + présent, главное → futur."),
  tx(529, 5, "Futur (être)", "Futur (ils): « Ils (être) contents. »", ["ils seront", "ils seront contents"], "Ils seront contents.", "être → seront."),
  mc(530, 5, "Futur (faire)", "Demain, nous ____ une promenade.", ["faisons", "ferons", "faisions", "ferions"], 1, "Nous ferons une promenade.", "faire → ferons."),

  // Partitif / impératif / quantité
  mc(531, 6, "Partitif", "Je mange ____ fromage après le repas.", ["de la", "du", "des", "le"], 1, "Je mange du fromage.", "fromage — м.р. → du."),
  mc(532, 6, "Quantité", "Ajoutez un peu ____ sel.", ["du", "de", "de la", "des"], 1, "un peu de sel", "un peu de + сущ."),
  tx(533, 6, "Impératif (vous)", "Impératif (vous) глагола faire: « ___ attention ! »", ["faites", "faites attention"], "Faites attention !", "faire (vous) → faites."),
  mc(534, 6, "Impératif (être)", "____ patients, le train arrive.", ["Soyez", "Êtes", "Serez", "Soit"], 0, "Soyez patients.", "Императив être (vous): soyez."),

  // Négation / discours
  mc(535, 8, "Négation (plus)", "Avant il habitait ici, mais il n'y habite ____.", ["pas", "plus", "jamais", "rien"], 1, "...il n'y habite plus.", "ne...plus = больше не."),
  tx(536, 8, "Négation (jamais)", "Переведите: « Я никогда не опаздываю. »", ["je ne suis jamais en retard", "je n'arrive jamais en retard"], "Je ne suis jamais en retard.", "ne...jamais = никогда."),
  mc(537, 8, "Discours indirect (si)", "Il demande : « Est-ce que tu pars ? » → Il demande ____ je pars.", ["que", "si", "où", "quand"], 1, "Il demande si je pars.", "Вопрос да/нет → si."),

  // Subjonctif / superlatif
  mc(538, 12, "Subjonctif (aller)", "Il faut que nous ____ chez le dentiste.", ["allons", "allions", "irons", "allons pas"], 1, "Il faut que nous allions chez le dentiste.", "aller в subjonctif: allions."),
  tx(539, 12, "Subjonctif (avoir)", "Subjonctif (que tu): « Je veux que tu ___ raison. »", ["aies", "que tu aies"], "Je veux que tu aies raison.", "avoir → que tu aies."),
  mc(540, 12, "Superlatif", "Le Mont Blanc est la montagne ____ haute des Alpes.", ["la plus", "plus", "très", "le plus"], 0, "...la plus haute des Alpes.", "Превосходная ж.р. → la plus."),

  // Gérondif / prépositions
  mc(541, 10, "Gérondif", "Ne lis pas ____ (manger).", ["en mangeant", "mangeant", "à manger", "de manger"], 0, "Ne lis pas en mangeant.", "Одновременность → en mangeant."),
  mc(542, 10, "Prépositions", "Je pars ____ vacances demain.", ["à", "en", "dans", "de"], 1, "Je pars en vacances.", "partir en vacances — устойчиво."),
  tx(543, 10, "Prépositions", "Вставьте: « Il revient ___ États-Unis. » (из)", ["des", "il revient des états-unis"], "Il revient des États-Unis.", "Из страны мн.ч. → des."),

  // Démonstratifs/possessifs
  mc(544, 11, "Démonstratif", "Je préfère ____ -ci à celui-là.", ["celui", "celle", "ceux", "ce"], 0, "Je préfère celui-ci.", "celui-ci/celui-là."),
  tx(545, 11, "Possessif", "Замените: « C'est leur maison. » → « C'est ___. »", ["la leur"], "C'est la leur.", "maison ж.р., их → la leur."),

  // Лексика-фразы
  mc(546, 1, "Lexique", "« être à l'heure » означает:", ["быть вовремя", "опаздывать", "торопиться", "ждать"], 0, "être à l'heure", "à l'heure = вовремя."),
  mc(547, 5, "Lexique", "« passer un entretien » означает:", ["проходить собеседование", "сдавать экзамен", "брать отпуск", "звонить"], 0, "passer un entretien", "passer un entretien = проходить собеседование."),
  mc(548, 9, "Lexique", "« faire des économies » означает:", ["копить/экономить деньги", "тратить деньги", "брать кредит", "покупать"], 0, "faire des économies", "faire des économies = экономить, копить."),
  tx(549, 7, "Lexique", "Переведите: « записаться на приём к врачу »", ["prendre rendez-vous chez le médecin", "prendre rendez-vous chez le docteur"], "prendre rendez-vous chez le médecin", "prendre rendez-vous = записаться."),
  mc(550, 10, "Lexique", "« annuler une réservation » означает:", ["отменить бронь", "подтвердить бронь", "перенести встречу", "оплатить"], 0, "annuler une réservation", "annuler = отменить."),

  // Аудирование / диктанты-вопросы
  tx(551, 3, "Compréhension orale", "🔊 Запишите:", ["nous avons emménagé dans un nouvel appartement"], "Nous avons emménagé dans un nouvel appartement.", "Passé composé: avons emménagé."),
  tx(552, 7, "Compréhension orale", "🔊 Запишите совет врача:", ["vous devez vous reposer et boire de l'eau"], "Vous devez vous reposer et boire de l'eau.", "devoir + инфинитивы."),
  mc(553, 5, "Compréhension orale", "🔊 Что прозвучало?", ["Nous partirons à huit heures.", "Nous partons à huit heures.", "Nous sommes partis à huit heures.", "Nous partions à huit heures."], 0, "Nous partirons à huit heures.", "Futur simple: partirons."),
  tx(554, 4, "Compréhension orale", "🔊 Запишите:", ["c'est le livre que je préfère"], "C'est le livre que je préfère.", "Относительное que."),

  // Говорение
  tx(555, 7, "Production orale", "🎙 Скажите, что у вас болит (avoir mal à):", ["j'ai mal à la tête", "j'ai mal au ventre"], "J'ai mal à la tête.", "avoir mal à + часть тела."),
  tx(556, 9, "Production orale", "🎙 Дайте совет об экологии (il faut):", ["il faut recycler les déchets", "il faut économiser l'énergie"], "Il faut recycler les déchets.", "il faut + инфинитив."),

  // Фонетика/орфография
  mc(557, 4, "Homophones (mais/mes)", "____ amis sont venus. (мои)", ["Mais", "Mes", "Met", "M'est"], 1, "Mes amis sont venus.", "mes (мои) vs mais (но)."),
  mc(558, 8, "Homophones (on/ont)", "Les voisins ____ un chien.", ["on", "ont", "om", "hon"], 1, "Les voisins ont un chien.", "ont (avoir) vs on (мы/безличное)."),
  mc(559, 1, "Homophones (et/est)", "Il est grand ____ fort.", ["est", "et", "ait", "ès"], 1, "Il est grand et fort.", "et (и) vs est (быть)."),
  tx(560, 6, "Orthographe (cédille)", "Напишите глагол: « Nous (commencer) à 9 h. »", ["nous commençons", "commençons"], "Nous commençons à 9 h.", "Перед o пишем ç: commençons."),

  // Числа/время/даты
  mc(561, 5, "Nombres", "« deux cents » это:", ["20", "200", "202", "2000"], 1, "deux cents", "200 = deux cents (с -s)."),
  mc(562, 2, "Date", "« le 14 juillet » во Франции — это:", ["День взятия Бастилии", "Рождество", "Новый год", "Пасха"], 0, "le 14 juillet", "Национальный праздник Франции."),
  tx(563, 5, "Nombres", "Напишите словами: « 90 »", ["quatre-vingt-dix"], "quatre-vingt-dix", "90 = quatre-vingt-dix."),

  // Связки/логика
  mc(564, 8, "Connecteurs (d'abord)", "____, je me lève, ensuite je prends le petit-déjeuner.", ["D'abord", "Enfin", "Mais", "Donc"], 0, "D'abord, je me lève...", "d'abord = сначала (порядок)."),
  mc(565, 8, "Connecteurs (enfin)", "Je travaille, je dîne et ____ je me couche.", ["d'abord", "enfin", "mais", "car"], 1, "...et enfin je me couche.", "enfin = наконец (завершение)."),
  mc(566, 9, "Connecteurs (pour)", "Je fais du sport ____ rester en forme.", ["pour", "parce que", "mais", "donc"], 0, "...pour rester en forme.", "pour + инфинитив = чтобы."),

  // Закрепление сложных мест
  mc(567, 1, "PC/imparfait", "Il faisait nuit quand nous ____ (rentrer).", ["rentrions", "sommes rentrés", "rentrons", "rentrerons"], 1, "...quand nous sommes rentrés.", "Событие → passé composé (être): sommes rentrés."),
  mc(568, 12, "Subjonctif vs indicatif", "Je pense qu'il ____ raison. (уверенность)", ["a", "ait", "aie", "avait"], 0, "Je pense qu'il a raison.", "penser que (утверждение) → indicatif: a."),
  mc(569, 12, "Subjonctif", "Je ne pense pas qu'il ____ raison.", ["a", "ait", "aura", "avait"], 1, "Je ne pense pas qu'il ait raison.", "Сомнение/отрицание мнения → subjonctif: ait."),
  tx(570, 10, "Gérondif", "Переведите: « Будь осторожен, переходя улицу. »", ["fais attention en traversant la rue", "sois prudent en traversant la rue"], "Fais attention en traversant la rue.", "Gérondif: en traversant."),
  mc(571, 7, "Pronom (lui/leur)", "Je ressemble à mon père → Je ____ ressemble.", ["le", "lui", "y", "en"], 1, "Je lui ressemble.", "ressembler à qqn → lui."),
  mc(572, 3, "Adjectif (beau/bel)", "Quel ____ appartement !", ["beau", "bel", "belle", "beaux"], 1, "Quel bel appartement !", "Перед гласной м.р. → bel."),
  mc(573, 11, "Démonstratif/relatif", "____ qui veulent participer doivent s'inscrire.", ["Celui", "Ceux", "Celles", "Ce"], 1, "Ceux qui veulent participer...", "Ceux qui = те, кто (мн.ч. м.р.)."),
  tx(574, 5, "Futur", "Переведите: « Однажды я выучу китайский. »", ["un jour j'apprendrai le chinois"], "Un jour, j'apprendrai le chinois.", "apprendre в futur → apprendrai."),
  mc(575, 9, "Il faut que / devoir", "Pour être en bonne santé, on ____ bien manger.", ["doit", "doive", "devra", "devrait"], 0, "...on doit bien manger.", "devoir présent (on): doit."),

  // ════ БЛОК 4: финальный добор (>400) ════
  mc(576, 1, "Passé composé", "Ce matin, tu ____ ton café ?", ["as bu", "bois", "buvais", "boiras"], 0, "Tu as bu ton café ?", "boire → bu."),
  mc(577, 1, "Passé composé (être)", "Mes amies ____ restées chez moi.", ["ont", "sont", "avaient", "seront"], 1, "Mes amies sont restées chez moi.", "rester с être → sont restées."),
  tx(578, 1, "Passé composé", "Поставьте: « Vous (comprendre) la leçon ? »", ["vous avez compris", "avez-vous compris la leçon"], "Vous avez compris la leçon ?", "comprendre → compris."),
  mc(579, 2, "Imparfait", "Il ____ une fois une petite fille.", ["est", "était", "a été", "fut"], 1, "Il était une fois une petite fille.", "Зачин сказки → imparfait: était."),
  mc(580, 2, "Imparfait", "Nous ____ souvent au cinéma le samedi.", ["allions", "sommes allés", "allons", "irons"], 0, "Nous allions souvent au cinéma.", "Привычка → imparfait: allions."),
  tx(581, 5, "Futur", "Futur (elle): « Elle (venir) la semaine prochaine. »", ["elle viendra"], "Elle viendra la semaine prochaine.", "venir → viendra."),
  mc(582, 5, "Futur (aller)", "Plus tard, nous ____ vivre à la campagne.", ["allons", "irons", "allions", "irions"], 1, "Nous irons vivre à la campagne.", "aller → irons."),
  mc(583, 4, "Comparatif", "Le français est ____ difficile que le chinois. (-)", ["plus", "moins", "aussi", "autant"], 1, "Le français est moins difficile que le chinois.", "Меньшая степень → moins ... que."),
  mc(584, 4, "Relatif", "C'est la raison ____ je suis venu.", ["que", "qui", "pour laquelle", "où"], 2, "C'est la raison pour laquelle je suis venu.", "raison pour laquelle = причина, по которой."),
  mc(585, 7, "COD/COI", "Je vous remercie → pronom « vous » здесь это:", ["COD", "COI", "sujet", "adverbe"], 0, "Je vous remercie.", "remercier qqn → COD (vous)."),
  tx(586, 7, "Pronom", "Замените: « Je donne le livre à Paul. » (оба местоимения)", ["je le lui donne"], "Je le lui donne.", "le (COD) + lui (COI)."),
  mc(587, 6, "Partitif", "Tu prends ____ confiture ?", ["du", "de la", "des", "le"], 1, "Tu prends de la confiture ?", "confiture — ж.р. → de la."),
  mc(588, 8, "Négation", "Il ne mange ____ viande ____ poisson.", ["ni / ni", "ne / pas", "pas / ni", "ni / pas"], 0, "Il ne mange ni viande ni poisson.", "ne...ni...ni = ни...ни."),
  tx(589, 12, "Subjonctif", "Subjonctif (que vous) глагола venir: « Il faut que vous ___. »", ["veniez", "que vous veniez"], "Il faut que vous veniez.", "venir → que vous veniez."),
  mc(590, 12, "Superlatif", "C'est ____ pire moment de ma vie.", ["le", "la", "les", "plus"], 0, "C'est le pire moment de ma vie.", "pire с артиклем: le pire."),
  mc(591, 10, "Gérondif", "Il a appris le français ____ (regarder) des films.", ["en regardant", "regardant", "à regarder", "de regarder"], 0, "...en regardant des films.", "Способ → en regardant."),
  mc(592, 10, "Prépositions", "Nous voyageons ____ Suisse cet hiver.", ["au", "en", "à", "aux"], 1, "...en Suisse.", "Страна ж.р. → en."),
  mc(593, 11, "Démonstratif", "De ces deux robes, je préfère ____.", ["celui-ci", "celle-ci", "ceux-ci", "ce"], 1, "...je préfère celle-ci.", "robe — ж.р. → celle-ci."),
  mc(594, 3, "Adjectif (nouveau/nouvel)", "C'est un ____ ami.", ["nouveau", "nouvel", "nouvelle", "nouveaux"], 1, "C'est un nouvel ami.", "Перед гласной м.р. → nouvel."),
  tx(595, 5, "Futur", "Переведите: « Завтра будет хорошая погода. »", ["demain il fera beau"], "Demain, il fera beau.", "faire в futur → fera."),
  mc(596, 8, "Connecteurs", "Il a beaucoup travaillé, ____ il a réussi.", ["mais", "c'est pourquoi", "ou", "ni"], 1, "...c'est pourquoi il a réussi.", "c'est pourquoi = вот почему (следствие)."),
  mc(597, 9, "Comparatif", "Plus on travaille, ____ on apprend.", ["plus", "moins", "aussi", "autant"], 0, "Plus on travaille, plus on apprend.", "Plus..., plus... = чем больше..., тем больше."),
  tx(598, 1, "Communication", "Переведите: « Извините за опоздание. »", ["désolé pour le retard", "excusez-moi pour le retard", "désolée pour le retard"], "Désolé pour le retard.", "Вежливое извинение."),
  mc(599, 7, "Pronom EN (santé)", "Des vitamines ? Le médecin dit qu'on ____ a besoin.", ["y", "en", "les", "leur"], 1, "...qu'on en a besoin.", "avoir besoin de → en."),
  mc(600, 2, "PC vs imparfait", "Quand le téléphone a sonné, je ____ (dormir).", ["dormais", "ai dormi", "dors", "dormirai"], 0, "...je dormais.", "Фон → imparfait: dormais."),
];
