// Расширенный банк заданий A2 (200+ вопросов) по всем грам.точкам Édito A2 / Odyssée A2 /
// Nouvelle Génération A2 / FLE au top A2. Контент написан по программе A2 (CEFR),
// без копирования текста учебников. Используется диагностикой, тренажёрами и экзаменом.

import { A2Question } from "./frenchA2";

// Помощник для краткости записи.
function mc(id: number, unit: number, gp: string, prompt: string, options: string[], answerIndex: number, speak: string, explanation: string, skill: A2Question["skill"] = "grammar"): A2Question {
  return { id, unit, skill, grammarPoint: gp, type: "mc", prompt, options, answerIndex, speak, explanation };
}
function tx(id: number, unit: number, gp: string, prompt: string, accept: string[], speak: string, explanation: string, skill: A2Question["skill"] = "grammar"): A2Question {
  return { id, unit, skill, grammarPoint: gp, type: "text", prompt, accept, speak, explanation };
}

// id начинаются со 100, чтобы не пересекаться с базовой диагностикой (1..45).
export const A2_BANK: A2Question[] = [
  // ═══════════ PASSÉ COMPOSÉ (U1) ═══════════
  mc(100, 1, "Passé composé", "Hier soir, nous ____ un film au cinéma.", ["avons vu", "voyons", "voyions", "verrons"], 0, "Hier soir, nous avons vu un film au cinéma.", "Завершённое действие в прошлом → passé composé: avoir + vu."),
  mc(101, 1, "Passé composé (être)", "Marie ____ tôt ce matin.", ["a parti", "est partie", "est parti", "partait"], 1, "Marie est partie tôt ce matin.", "partir с être; причастие согласуется с ж.р.: partie."),
  mc(102, 1, "Passé composé (pronominal)", "Ils ____ à 7 heures.", ["ont levé", "se sont levés", "sont levé", "se levaient"], 1, "Ils se sont levés à 7 heures.", "Возвратные глаголы → être: se sont levés (+s, мн.ч.)."),
  tx(103, 1, "Passé composé", "Поставьте в passé composé: « Je (finir) mon travail. »", ["j'ai fini", "j'ai fini mon travail"], "J'ai fini mon travail.", "finir → participe fini, с avoir."),
  tx(104, 1, "Passé composé (être)", "Passé composé: « Elles (venir) hier. »", ["elles sont venues"], "Elles sont venues hier.", "venir с être, согласование ж.р. мн.ч.: venues."),
  mc(105, 1, "Participe passé", "Participe passé глагола « prendre »:", ["prendu", "pris", "prendé", "prie"], 1, "pris", "Неправильное причастие: prendre → pris."),
  mc(106, 1, "Participe passé", "Participe passé глагола « faire »:", ["fait", "fais", "faisé", "faisu"], 0, "fait", "faire → fait."),
  mc(107, 1, "Passé composé (négation)", "Forme négative: « J'ai mangé. »", ["Je n'ai pas mangé", "Je ne mange pas", "J'ai ne pas mangé", "Je n'ai mangé pas"], 0, "Je n'ai pas mangé.", "ne...pas обрамляют вспомогательный глагол."),
  tx(108, 1, "Passé composé", "Passé composé: « Tu (écrire) une lettre. »", ["tu as écrit", "tu as écrit une lettre"], "Tu as écrit une lettre.", "écrire → écrit."),

  // ═══════════ IMPARFAIT (U2) ═══════════
  mc(110, 2, "Imparfait", "Avant, nous ____ à la campagne.", ["habitons", "avons habité", "habitions", "habiterons"], 2, "Avant, nous habitions à la campagne.", "Привычка/состояние в прошлом → imparfait: habitions."),
  mc(111, 2, "Imparfait", "Quand il ____ jeune, il jouait au foot.", ["est", "était", "a été", "sera"], 1, "Quand il était jeune, il jouait au foot.", "Описание → imparfait être: était."),
  tx(112, 2, "Imparfait формы", "Imparfait (nous) глагола faire:", ["nous faisions", "faisions"], "Nous faisions.", "Основа nous (faisons) + -ions: faisions."),
  mc(113, 2, "Imparfait vs PC", "Il ____ (lire) quand je suis entré.", ["lisait", "a lu", "lit", "lira"], 0, "Il lisait quand je suis entré.", "Фон (длительное) → imparfait; событие → passé composé."),
  mc(114, 2, "Imparfait vs PC", "Soudain, le téléphone ____.", ["sonnait", "a sonné", "sonne", "sonnerait"], 1, "Soudain, le téléphone a sonné.", "Внезапное завершённое событие → passé composé."),
  tx(115, 2, "Imparfait", "Imparfait: « Vous (avoir) une voiture. »", ["vous aviez", "vous aviez une voiture"], "Vous aviez une voiture.", "avoir в imparfait: aviez."),
  mc(116, 2, "Imparfait (avait)", "Il y ____ beaucoup de monde.", ["a eu", "avait", "aura", "a"], 1, "Il y avait beaucoup de monde.", "Описание прошлого → il y avait."),

  // ═══════════ Y / EN (U3) ═══════════
  mc(120, 3, "Pronom Y", "Tu penses à ton examen ? — Oui, j'____ pense.", ["en", "y", "le", "lui"], 1, "Oui, j'y pense.", "penser à qqch → y."),
  mc(121, 3, "Pronom EN", "Tu as des frères ? — Oui, j'____ ai deux.", ["y", "en", "les", "de"], 1, "Oui, j'en ai deux.", "Количество → en (j'en ai deux)."),
  mc(122, 3, "Pronom Y", "Vous allez au marché ? — Nous ____ allons.", ["en", "y", "le", "la"], 1, "Nous y allons.", "aller à un lieu → y."),
  tx(123, 3, "Pronom EN", "Замените: « Je bois du café. » → « J'____ bois. »", ["en", "j'en bois"], "J'en bois.", "du café → en."),
  mc(124, 3, "Place de l'adjectif", "C'est un ____ restaurant.", ["restaurant bon", "bon restaurant", "restaurant bonne", "bonne restaurant"], 1, "un bon restaurant", "bon — перед существительным."),
  mc(125, 3, "Place de l'adjectif", "Une voiture ____.", ["rouge", "rouge belle", "belle rouge", "rouge belles"], 0, "une voiture rouge", "Цвет — после существительного: voiture rouge."),
  tx(126, 3, "Pronom Y", "Ответьте с « y »: « Tu vas à Paris ? » → « Oui, ___. »", ["oui, j'y vais", "j'y vais"], "Oui, j'y vais.", "à Paris → y."),

  // ═══════════ COMPARATIF / RELATIFS (U4) ═══════════
  mc(130, 4, "Comparatif", "Lyon est ____ grande que Paris. (-)", ["plus", "moins", "aussi", "meilleure"], 1, "Lyon est moins grande que Paris.", "Меньшая степень → moins ... que."),
  mc(131, 4, "Comparatif (mieux)", "Elle chante ____ que moi.", ["meilleur", "mieux", "plus bon", "plus bien"], 1, "Elle chante mieux que moi.", "bien в сравнении → mieux (с глаголом)."),
  mc(132, 4, "Relatif qui", "Voici le bus ____ va au centre.", ["que", "qui", "où", "dont"], 1, "Voici le bus qui va au centre.", "qui — подлежащее (он идёт)."),
  mc(133, 4, "Relatif que", "Le film ____ j'ai vu était super.", ["qui", "que", "où", "dont"], 1, "Le film que j'ai vu était super.", "que — прямое дополнение (я видел его)."),
  mc(134, 4, "Relatif où", "C'est le jour ____ je suis né.", ["qui", "que", "où", "dont"], 2, "C'est le jour où je suis né.", "où — для времени и места."),
  tx(135, 4, "Comparatif", "Сравните (=): « Il est ___ grand ___ son frère. »", ["aussi grand que", "aussi ... que"], "Il est aussi grand que son frère.", "Равенство → aussi + прилаг. + que."),
  mc(136, 4, "Superlatif", "C'est le restaurant ____ cher du quartier.", ["plus", "le plus", "très", "moins de"], 1, "C'est le restaurant le plus cher du quartier.", "Превосходная степень → le plus."),

  // ═══════════ FUTUR SIMPLE (U5) ═══════════
  mc(140, 5, "Futur simple", "Demain, il ____ beau.", ["fait", "faisait", "fera", "a fait"], 2, "Demain, il fera beau.", "faire в futur: основа fer- → fera."),
  mc(141, 5, "Futur simple", "Nous ____ en vacances en juillet.", ["partons", "partirons", "partions", "sommes partis"], 1, "Nous partirons en vacances en juillet.", "partir → partirons."),
  tx(142, 5, "Futur simple (avoir)", "Futur: « Tu (avoir) 18 ans bientôt. »", ["tu auras", "tu auras 18 ans bientôt"], "Tu auras 18 ans bientôt.", "avoir в futur: основа aur- → auras."),
  mc(143, 5, "Futur simple (aller)", "Un jour, j'____ au Canada.", ["vais", "irai", "allais", "irais"], 1, "Un jour, j'irai au Canada.", "aller в futur: основа ir- → irai."),
  tx(144, 5, "Futur simple (venir)", "Futur: « Ils (venir) demain. »", ["ils viendront"], "Ils viendront demain.", "venir → viendront."),
  mc(145, 5, "Futur proche", "Regarde les nuages, il ____ pleuvoir.", ["va", "ira", "allait", "est allé"], 0, "Il va pleuvoir.", "Близкое событие → futur proche: aller + inf."),

  // ═══════════ PARTITIFS / IMPÉRATIF (U6) ═══════════
  mc(150, 6, "Partitif", "Le matin, je prends ____ café.", ["un", "du", "de la", "des"], 1, "Je prends du café.", "Неисчисляемое м.р. → du."),
  mc(151, 6, "Partitif", "Elle achète ____ farine.", ["du", "de la", "des", "le"], 1, "Elle achète de la farine.", "farine — ж.р. → de la."),
  mc(152, 6, "Partitif (quantité)", "Un kilo ____ pommes, s'il vous plaît.", ["des", "de la", "de", "du"], 2, "Un kilo de pommes.", "После количества → de."),
  mc(153, 6, "Partitif (négation)", "Il n'y a plus ____ lait.", ["du", "de la", "de", "des"], 2, "Il n'y a plus de lait.", "После отрицания → de."),
  tx(154, 6, "Impératif", "Impératif (vous) глагола prendre: « ___ une chaise. »", ["prenez", "prenez une chaise"], "Prenez une chaise.", "prendre → prenez."),
  mc(155, 6, "Impératif (négatif)", "____ pas de bruit !", ["Fais", "Ne fais", "Faisons", "Faites"], 1, "Ne fais pas de bruit !", "Отрицательный императив: ne fais pas."),
  tx(156, 6, "Impératif (pronom)", "Impératif с местоимением: « Le gâteau ? ___-le ! » (manger, tu)", ["mange", "mange-le"], "Mange-le !", "manger (tu) без -s + -le: mange-le."),

  // ═══════════ COD / COI (U7) ═══════════
  mc(160, 7, "COD", "Ce livre, je ____ adore.", ["lui", "l'", "y", "en"], 1, "Ce livre, je l'adore.", "livre — прямое дополнение → l'."),
  mc(161, 7, "COI", "J'écris à ma mère → Je ____ écris.", ["la", "lui", "l'", "y"], 1, "Je lui écris.", "écrire à qqn → lui."),
  mc(162, 7, "COD (pluriel)", "Tes amis ? Je ____ vois souvent.", ["leur", "les", "lui", "en"], 1, "Je les vois souvent.", "voir qqn (мн.ч.) → les."),
  tx(163, 7, "COI (pluriel)", "Замените: « Je téléphone à mes parents. » → « Je ___ téléphone. »", ["leur", "je leur téléphone"], "Je leur téléphone.", "téléphoner à (мн.ч.) → leur."),
  mc(164, 7, "COD (passé)", "La lettre ? Je ____ ai lue.", ["la", "l'", "lui", "les"], 1, "Je l'ai lue.", "Перед гласной → l'; причастие согласуется: lue."),
  mc(165, 7, "Conseils (devrais)", "Tu es fatigué, tu ____ te reposer.", ["dois", "devrais", "as", "fais"], 1, "Tu devrais te reposer.", "Совет → conditionnel: tu devrais."),

  // ═══════════ DISCOURS INDIRECT / NÉGATIONS (U8) ═══════════
  mc(170, 8, "Discours indirect", "Elle demande : « Tu viens ? » → Elle demande ____ je viens.", ["que", "si", "qui", "quoi"], 1, "Elle demande si je viens.", "Вопрос да/нет → si."),
  mc(171, 8, "Négation jamais", "Je ne regarde ____ la télé le matin.", ["plus", "jamais", "rien", "personne"], 1, "Je ne regarde jamais la télé le matin.", "ne...jamais = никогда."),
  mc(172, 8, "Négation personne", "Il n'y a ____ dans la rue.", ["rien", "personne", "jamais", "plus"], 1, "Il n'y a personne dans la rue.", "ne...personne = никого."),
  tx(173, 8, "Négation rien", "Переведите: « Я ничего не понял. »", ["je n'ai rien compris"], "Je n'ai rien compris.", "ne...rien в passé: n'ai rien compris."),
  mc(174, 8, "Discours indirect", "Il dit : « Je pars. » → Il dit qu'il ____.", ["pars", "part", "partez", "partir"], 1, "Il dit qu'il part.", "Косвенная речь: меняется лицо → part."),

  // ═══════════ ÉQUIVALENCE / IL FAUT (U9) ═══════════
  mc(180, 9, "Équivalence", "Je travaille ____ que toi.", ["autant", "aussi", "plus de", "autant de"], 0, "Je travaille autant que toi.", "С глаголом → autant que."),
  mc(181, 9, "Équivalence", "Il a ____ d'amis que moi.", ["aussi", "autant", "plus", "meilleur"], 1, "Il a autant d'amis que moi.", "С существительным → autant de ... que."),
  mc(182, 9, "Il faut", "Pour réussir, il faut ____ beaucoup.", ["travailler", "travaillé", "travaille", "travaillant"], 0, "Il faut travailler beaucoup.", "il faut + инфинитив."),
  tx(183, 9, "Devoir", "Спряжение devoir (nous): « Nous ___ recycler. »", ["nous devons", "devons"], "Nous devons recycler.", "devoir: nous devons."),
  mc(184, 9, "Il faut que (subj)", "Il faut que tu ____ attention.", ["fais", "fasses", "feras", "faisais"], 1, "Il faut que tu fasses attention.", "il faut que → subjonctif: fasses."),

  // ═══════════ GÉRONDIF / PRÉPOSITIONS (U10) ═══════════
  mc(190, 10, "Gérondif", "Il s'est blessé ____ (courir).", ["en courant", "courant", "à courir", "de courir"], 0, "Il s'est blessé en courant.", "Одновременность → en + courant."),
  tx(191, 10, "Gérondif", "Образуйте gérondif от « manger »:", ["en mangeant"], "en mangeant", "Основа nous (mangeons) + -ant → en mangeant."),
  mc(192, 10, "Prépositions pays", "Nous allons ____ Espagne.", ["au", "en", "à", "aux"], 1, "Nous allons en Espagne.", "Страна ж.р. → en."),
  mc(193, 10, "Prépositions pays", "Il habite ____ Maroc.", ["en", "au", "à", "aux"], 1, "Il habite au Maroc.", "Страна м.р. → au."),
  mc(194, 10, "Prépositions villes", "Je suis ____ Berlin.", ["en", "au", "à", "aux"], 2, "Je suis à Berlin.", "Город → à."),
  tx(195, 10, "Gérondif", "Переведите: « Он учится, слушая музыку. »", ["il étudie en écoutant de la musique", "il apprend en écoutant de la musique"], "Il étudie en écoutant de la musique.", "Способ → gérondif: en écoutant."),

  // ═══════════ DÉMONSTRATIFS / POSSESSIFS (U11) ═══════════
  mc(200, 11, "Démonstratif", "Quelles chaussures ? — ____-ci.", ["Celui", "Celle", "Ceux", "Celles"], 3, "Celles-ci.", "chaussures — ж.р. мн.ч. → celles."),
  mc(201, 11, "Démonstratif", "Quel gâteau préfères-tu ? — ____ au chocolat.", ["Celui", "Celle", "Ceux", "Ce"], 0, "Celui au chocolat.", "gâteau — м.р. ед.ч. → celui."),
  mc(202, 11, "Possessif", "Ce sont tes clés ? — Oui, ce sont ____.", ["les miens", "les miennes", "la mienne", "le mien"], 1, "Ce sont les miennes.", "clés — ж.р. мн.ч. → les miennes."),
  tx(203, 11, "Possessif", "Замените: « C'est notre maison. » → « C'est ___. »", ["la nôtre"], "C'est la nôtre.", "maison ж.р., наша → la nôtre."),
  mc(204, 11, "Lexique parcours", "« postuler » означает:", ["увольняться", "подавать заявку на работу", "опаздывать", "учиться"], 1, "postuler", "postuler = подавать заявку (на работу)."),

  // ═══════════ SUBJONCTIF / SUPERLATIF (U12) ═══════════
  mc(210, 12, "Subjonctif", "Je veux que tu ____ content.", ["es", "sois", "seras", "étais"], 1, "Je veux que tu sois content.", "Желание → subjonctif: que tu sois."),
  mc(211, 12, "Subjonctif", "Il faut que nous ____ maintenant.", ["partons", "partions", "partirons", "partir"], 1, "Il faut que nous partions.", "il faut que → subjonctif: partions."),
  tx(212, 12, "Subjonctif", "Subjonctif (que je) глагола faire: « ... que je ___. »", ["fasse", "que je fasse"], "que je fasse", "faire → que je fasse."),
  mc(213, 12, "Subjonctif (avoir)", "Je suis content que tu ____ le temps.", ["as", "aies", "auras", "avais"], 1, "Je suis content que tu aies le temps.", "Эмоция → subjonctif avoir: aies."),
  mc(214, 12, "Superlatif (meilleur)", "C'est ____ restaurant de la ville.", ["le plus bon", "le meilleur", "le mieux", "plus bon"], 1, "C'est le meilleur restaurant de la ville.", "bon в превосходной → le meilleur."),
  tx(215, 12, "Superlatif", "Переведите: « Это самый красивый пейзаж. »", ["c'est le plus beau paysage"], "C'est le plus beau paysage.", "Превосходная степень → le plus beau."),

  // ═══════════ ЛЕКСИКА В КОНТЕКСТЕ (разные юниты) ═══════════
  mc(220, 3, "Lexique logement", "« louer un appartement » означает:", ["продать квартиру", "снять/арендовать квартиру", "убрать квартиру", "построить дом"], 1, "louer un appartement", "louer = снимать/арендовать."),
  mc(221, 7, "Lexique santé", "« J'ai mal à la gorge » означает:", ["болит горло", "болит нога", "болит зуб", "кружится голова"], 0, "J'ai mal à la gorge.", "avoir mal à la gorge = болит горло."),
  mc(222, 9, "Lexique écologie", "« le gaspillage alimentaire » — это:", ["переработка", "пищевые отходы/расточительство еды", "доставка еды", "приготовление"], 1, "le gaspillage alimentaire", "gaspillage = расточительство, выбрасывание."),
  tx(223, 6, "Lexique cuisine", "Переведите: « смешать ингредиенты »", ["mélanger les ingrédients"], "mélanger les ingrédients", "mélanger = смешивать."),
  mc(224, 10, "Lexique voyage", "« réserver un billet » означает:", ["потерять билет", "забронировать билет", "купить чемодан", "опоздать"], 1, "réserver un billet", "réserver = бронировать."),

  // ═══════════ АУДИРОВАНИЕ (skill listening) ═══════════
  mc(230, 1, "Compréhension orale", "🔊 Что вы услышали?", ["Nous avons déménagé.", "Nous déménageons.", "Nous déménagerons.", "Nous déménagions."], 0, "Nous avons déménagé.", "Passé composé: avons déménagé."),
  tx(231, 5, "Compréhension orale", "🔊 Запишите услышанную фразу:", ["nous partirons en vacances en juillet"], "Nous partirons en vacances en juillet.", "Futur simple: partirons."),
  tx(232, 8, "Compréhension orale", "🔊 Запишите услышанное:", ["je ne regarde jamais la télé"], "Je ne regarde jamais la télé.", "Отрицание ne...jamais."),
  mc(233, 9, "Compréhension orale", "🔊 Какая фраза прозвучала?", ["Il faut recycler.", "Il a recyclé.", "Il faudra recycler.", "Il recyclait."], 0, "Il faut recycler.", "il faut + инфинитив."),
  tx(234, 12, "Compréhension orale", "🔊 Запишите:", ["il faut que nous protégions la nature"], "Il faut que nous protégions la nature.", "Subjonctif: protégions."),
  tx(235, 2, "Compréhension orale", "🔊 Запишите услышанное:", ["quand j'étais petit je jouais au foot"], "Quand j'étais petit, je jouais au foot.", "Imparfait: étais, jouais."),

  // ═══════════ ГОВОРЕНИЕ (skill speaking) ═══════════
  tx(240, 4, "Production orale", "🎙 Произнесите и впишите сравнение: « Lyon / Paris (моложе) »", ["lyon est plus jeune que paris"], "Lyon est plus jeune que Paris.", "Сравнение plus ... que."),
  tx(241, 11, "Production orale", "🎙 Произнесите фразу о профессии (métier de rêve):", ["mon métier de rêve est professeur", "mon métier de rêve est médecin"], "Mon métier de rêve est professeur.", "Лексика профессий + структура."),
  mc(242, 6, "Production orale", "🎙 Произнесите рецепт. Какой здесь императив?", ["ajoute", "ajouter", "ajoutant", "ajouté"], 0, "Ajoute du sel et mélange bien.", "Императив (tu): ajoute."),

  // ═══════════ БЛОК 2: углубление ═══════════
  // Passé composé — согласование и неправильные причастия
  mc(250, 1, "Participe passé", "Participe passé глагола « mettre »:", ["mis", "metté", "mettu", "met"], 0, "mis", "mettre → mis."),
  mc(251, 1, "Participe passé", "Participe passé глагола « ouvrir »:", ["ouvri", "ouvert", "ouvré", "ouvru"], 1, "ouvert", "ouvrir → ouvert."),
  mc(252, 1, "Participe passé", "Participe passé глагола « lire »:", ["lu", "lit", "lisé", "li"], 0, "lu", "lire → lu."),
  mc(253, 1, "Participe passé", "Participe passé глагола « boire »:", ["bu", "boit", "bevé", "boivu"], 0, "bu", "boire → bu."),
  tx(254, 1, "Passé composé (être)", "Passé composé: « Nous (arriver) en retard. »", ["nous sommes arrivés", "nous sommes arrivées"], "Nous sommes arrivés en retard.", "arriver с être, согласование мн.ч.: arrivés."),
  mc(255, 1, "Passé composé (pronominal)", "Elle ____ ce matin.", ["s'est réveillée", "a réveillé", "est réveillé", "se réveillait"], 0, "Elle s'est réveillée ce matin.", "Возвратный → être + согласование ж.р.: réveillée."),
  tx(256, 1, "Passé composé", "Поставьте в passé composé: « Vous (voir) ce film ? »", ["vous avez vu ce film", "avez-vous vu ce film"], "Vous avez vu ce film ?", "voir → vu, с avoir."),

  // Imparfait расширение
  mc(257, 2, "Imparfait", "Tous les étés, nous ____ à la mer.", ["allons", "allions", "sommes allés", "irons"], 1, "Tous les étés, nous allions à la mer.", "Повторяющаяся привычка → imparfait: allions."),
  mc(258, 2, "Imparfait vs PC", "Je dormais quand tu ____ (téléphoner).", ["téléphonais", "as téléphoné", "téléphones", "téléphoneras"], 1, "Je dormais quand tu as téléphoné.", "Прерывающее событие → passé composé."),
  tx(259, 2, "Imparfait", "Imparfait: « Il (pleuvoir) ce jour-là. »", ["il pleuvait"], "Il pleuvait ce jour-là.", "pleuvoir в imparfait: pleuvait."),
  mc(260, 2, "Imparfait (faire описание)", "Il ____ froid et il neigeait.", ["fait", "faisait", "a fait", "fera"], 1, "Il faisait froid et il neigeait.", "Описание погоды в прошлом → imparfait."),

  // Y/EN углубление
  mc(261, 3, "Pronom EN", "Combien de livres as-tu ? — J'____ ai cinq.", ["y", "en", "les", "des"], 1, "J'en ai cinq.", "Количество → en."),
  mc(262, 3, "Y vs EN", "Tu reviens de Paris ? — Oui, j'____ reviens.", ["y", "en", "le", "la"], 1, "J'en reviens.", "revenir de un lieu → en."),
  tx(263, 3, "Pronom Y", "Замените: « Je pense à mes vacances. » → « J'___ pense. »", ["y", "j'y pense"], "J'y pense.", "penser à qqch → y."),
  mc(264, 3, "Adjectifs (accord)", "Des fleurs ____.", ["blanc", "blanche", "blanches", "blancs"], 2, "des fleurs blanches", "fleurs ж.р. мн.ч. → blanches."),

  // Comparatif/relatifs углубление
  mc(265, 4, "Comparatif (pire)", "Sa situation est ____ qu'avant. (- bonne)", ["plus bonne", "pire", "mieux", "meilleure"], 1, "Sa situation est pire qu'avant.", "mauvais в сравнении → pire."),
  mc(266, 4, "Relatif dont", "Le livre ____ je parle est célèbre.", ["que", "qui", "dont", "où"], 2, "Le livre dont je parle est célèbre.", "parler de → dont."),
  tx(267, 4, "Relatif qui/que", "Вставьте: « La personne ___ travaille ici est sympa. »", ["qui", "la personne qui travaille ici est sympa"], "La personne qui travaille ici est sympa.", "Подлежащее → qui."),
  mc(268, 4, "Superlatif (moins)", "C'est la solution ____ chère.", ["la plus", "la moins", "moins de", "le moins"], 1, "C'est la solution la moins chère.", "Наименьшая степень ж.р. → la moins."),

  // Futur углубление
  mc(269, 5, "Futur simple (être)", "Quand je ____ grand, je serai pilote.", ["suis", "serai", "étais", "serais"], 1, "Quand je serai grand, je serai pilote.", "После quand о будущем → futur: serai."),
  tx(270, 5, "Futur simple (faire)", "Futur: « Vous (faire) attention. »", ["vous ferez", "vous ferez attention"], "Vous ferez attention.", "faire → ferez."),
  mc(271, 5, "Futur simple (pouvoir)", "Demain, tu ____ venir.", ["peux", "pourras", "pouvais", "pourrais"], 1, "Demain, tu pourras venir.", "pouvoir в futur: основа pourr- → pourras."),
  tx(272, 5, "Futur simple (voir)", "Futur: « Nous (voir) le résultat. »", ["nous verrons", "nous verrons le résultat"], "Nous verrons le résultat.", "voir → verrons."),

  // Partitif/impératif углубление
  mc(273, 6, "Partitif", "Tu veux ____ thé ou ____ café ?", ["du / du", "de la / du", "du / de la", "des / du"], 0, "Tu veux du thé ou du café ?", "thé и café — м.р. → du."),
  mc(274, 6, "Impératif (être)", "____ sage !", ["Es", "Sois", "Sera", "Soit"], 1, "Sois sage !", "Императив être (tu): sois."),
  tx(275, 6, "Impératif (nous)", "Impératif (nous) глагола aller: « ___-y ! »", ["allons", "allons-y"], "Allons-y !", "aller (nous) → allons; allons-y."),
  mc(276, 6, "Partitif (négation)", "Je ne bois pas ____ alcool.", ["de l'", "d'", "du", "de la"], 1, "Je ne bois pas d'alcool.", "После отрицания → de/d' перед гласной."),

  // COD/COI углубление
  mc(277, 7, "COD/COI (lui)", "Je donne le cadeau à Paul → Je ____ donne.", ["le lui", "lui le", "la lui", "lui"], 0, "Je le lui donne.", "Два местоимения: le (COD) + lui (COI)."),
  mc(278, 7, "COD (me)", "Il ____ regarde.", ["me", "moi", "je", "m'a"], 0, "Il me regarde.", "me — COD 1 л."),
  tx(279, 7, "COI", "Замените: « Je réponds à mon professeur. » → « Je ___ réponds. »", ["lui", "je lui réponds"], "Je lui réponds.", "répondre à qqn → lui."),
  mc(280, 7, "Lexique santé", "Pour aller mieux, le médecin me donne une ____.", ["ordonnance", "addition", "facture", "recette"], 0, "une ordonnance", "ordonnance = рецепт врача."),

  // Discours indirect / négation углубление
  mc(281, 8, "Discours indirect", "Il demande : « Où vas-tu ? » → Il demande ____ je vais.", ["que", "si", "où", "quoi"], 2, "Il demande où je vais.", "Вопросительное слово сохраняется: où."),
  mc(282, 8, "Négation (ne...que)", "Je ____ ai ____ dix euros. (только)", ["ne / que", "ne / pas", "n' / plus", "ne / rien"], 0, "Je n'ai que dix euros.", "ne...que = только."),
  tx(283, 8, "Négation plus", "Переведите: « Я больше не курю. »", ["je ne fume plus"], "Je ne fume plus.", "ne...plus = больше не."),
  mc(284, 8, "Lexique médias", "« un titre » в газете — это:", ["заголовок", "подписка", "редактор", "тираж"], 0, "un titre", "titre = заголовок."),

  // Équivalence / il faut углубление
  mc(285, 9, "Subjonctif (il faut que)", "Il faut que vous ____ tôt.", ["partez", "partiez", "partez pas", "partir"], 1, "Il faut que vous partiez tôt.", "il faut que → subjonctif: partiez."),
  tx(286, 9, "Devoir (conditionnel)", "Совет: « Tu (devoir) économiser l'eau. »", ["tu devrais économiser l'eau", "tu devrais"], "Tu devrais économiser l'eau.", "Совет → conditionnel devrais."),
  mc(287, 9, "Lexique conso", "« acheter en vrac » означает:", ["покупать на развес/без упаковки", "покупать онлайн", "покупать дорого", "покупать оптом в кредит"], 0, "acheter en vrac", "en vrac = на развес, без упаковки."),

  // Gérondif / prépositions углубление
  mc(288, 10, "Gérondif (condition)", "____ (travailler) plus, tu réussiras.", ["En travaillant", "Travaillant", "À travailler", "Pour travailler"], 0, "En travaillant plus, tu réussiras.", "Условие → gérondif: en travaillant."),
  tx(289, 10, "Prépositions", "Вставьте предлог: « Je reviens ___ Italie. » (из)", ["d'", "je reviens d'italie"], "Je reviens d'Italie.", "Из страны ж.р. → de/d'."),
  mc(290, 10, "Prépositions (aux)", "Ils voyagent ____ Philippines.", ["en", "au", "à", "aux"], 3, "aux Philippines", "Страна мн.ч. → aux."),

  // Démonstratifs/possessifs углубление
  mc(291, 11, "Démonstratif (celui qui)", "____ qui veut peut réussir.", ["Celui", "Celle", "Ceux", "Ce"], 0, "Celui qui veut peut réussir.", "celui qui = тот, кто."),
  tx(292, 11, "Possessif", "Замените: « C'est ton idée. » → « C'est ___. »", ["la tienne"], "C'est la tienne.", "idée ж.р., твоя → la tienne."),
  mc(293, 11, "Lexique travail", "« un entretien d'embauche » — это:", ["собеседование при приёме на работу", "увольнение", "отпуск", "зарплата"], 0, "un entretien d'embauche", "собеседование о приёме."),

  // Subjonctif/superlatif углубление
  mc(294, 12, "Subjonctif (aller)", "Il faut que tu ____ chez le médecin.", ["vas", "ailles", "iras", "allais"], 1, "Il faut que tu ailles chez le médecin.", "aller в subjonctif: ailles."),
  mc(295, 12, "Subjonctif (pouvoir)", "Je veux qu'il ____ venir.", ["peut", "puisse", "pourra", "pouvait"], 1, "Je veux qu'il puisse venir.", "pouvoir в subjonctif: puisse."),
  tx(296, 12, "Superlatif (mieux)", "Переведите: « Она поёт лучше всех. »", ["elle chante le mieux"], "Elle chante le mieux.", "Превосходная от bien → le mieux."),

  // Дополнительное аудирование/диктанты как вопросы
  tx(297, 6, "Compréhension orale", "🔊 Запишите рецептную фразу:", ["ajoutez du sel et mélangez bien"], "Ajoutez du sel et mélangez bien.", "Императив (vous): ajoutez, mélangez."),
  tx(298, 4, "Compréhension orale", "🔊 Запишите услышанное:", ["elle est plus grande que sa soeur", "elle est plus grande que sa sœur"], "Elle est plus grande que sa sœur.", "Сравнение plus...que."),
  mc(299, 10, "Compréhension orale", "🔊 Что прозвучало?", ["En arrivant, j'ai vu la mer.", "En arrivant, je vois la mer.", "J'arrive et je vois la mer.", "Quand j'arrive, je vois la mer."], 0, "En arrivant, j'ai vu la mer.", "Gérondif + passé composé."),

  // ═══════════ БЛОК 3: фонетика, орфография, ловушки ═══════════
  mc(300, 2, "Phonie-graphie", "Какое слово звучит как [vɛʁ] и значит «зелёный»?", ["verre", "vers", "vert", "ver"], 2, "vert", "Омофоны: vert (зелёный), verre (стакан), vers (к), ver (червь)."),
  mc(301, 8, "Homophones", "« Il ___ content. » (быть)", ["et", "est", "es", "ai"], 1, "Il est content.", "est (être) vs et (и) — омофоны."),
  mc(302, 1, "Homophones a/à", "« Elle va ___ Paris. »", ["a", "à", "as", "at"], 1, "Elle va à Paris.", "à (предлог) vs a (avoir)."),
  mc(303, 7, "Homophones", "« ___ livre est intéressant. » (этот, м.р.)", ["Ces", "Ses", "C'est", "Ce"], 3, "Ce livre est intéressant.", "ce (указат.) vs ses (его) vs ces (эти)."),
  mc(304, 4, "Accents", "Правильное написание «уже»:", ["deja", "déjà", "dejà", "déja"], 1, "déjà", "déjà — два разных акцента."),
  tx(305, 5, "Orthographe futur", "Futur (je) глагола appeler: « Je t'___ demain. »", ["appellerai", "je t'appellerai"], "Je t'appellerai demain.", "appeler удваивает l в futur: appellerai."),
  mc(306, 6, "Liaison", "Где есть обязательная связка (liaison)?", ["les // amis", "les‿amis", "le‿ami", "la‿amie"], 1, "les‿amis", "les amis — связка [z]."),
  mc(307, 3, "Élision", "Правильно:", ["je ai", "j'ai", "je'ai", "ja i"], 1, "j'ai", "Перед гласной je → j'."),

  // Числа/дата/время A2
  mc(308, 5, "Nombres", "« quatre-vingt-dix » это:", ["80", "90", "70", "99"], 1, "quatre-vingt-dix", "90 = quatre-vingt-dix."),
  tx(309, 5, "Nombres", "Напишите словами: « 75 »", ["soixante-quinze"], "soixante-quinze", "75 = soixante-quinze."),
  mc(310, 2, "Date", "« le premier mai » это:", ["1 мая", "2 мая", "первое мая (праздник труда)", "и 1 и 3"], 2, "le premier mai", "1-е число → premier; 1 мая — праздник."),

  // Предлоги времени
  mc(311, 5, "Prépositions temps", "Je travaille ___ trois ans ici.", ["depuis", "pendant", "il y a", "dans"], 0, "depuis trois ans", "depuis = с (продолжается до сих пор)."),
  mc(312, 5, "Prépositions temps", "J'ai fini ___ deux heures.", ["depuis", "en", "dans", "pendant"], 1, "en deux heures", "en = за (длительность выполнения)."),
  mc(313, 5, "Prépositions temps", "Le train part ___ dix minutes.", ["depuis", "il y a", "dans", "en"], 2, "dans dix minutes", "dans = через (в будущем)."),

  // Вопросы (формы)
  mc(314, 8, "Question (est-ce que)", "____ tu aimes le café ?", ["Est-ce que", "Qu'est-ce", "Quoi", "Comment que"], 0, "Est-ce que tu aimes le café ?", "Общий вопрос → Est-ce que."),
  mc(315, 8, "Question (inversion)", "Инверсия: « Tu viens. » →", ["Viens-tu ?", "Tu viens-?", "Est viens tu ?", "Viens tu est ?"], 0, "Viens-tu ?", "Инверсия подлежащего и глагола."),
  tx(316, 11, "Question quel", "Вставьте: « ___ est ton métier ? »", ["quel", "quel est ton métier"], "Quel est ton métier ?", "quel — вопросительное прилагательное м.р."),

  // Лексика-фразы дополнительно
  mc(317, 1, "Lexique", "« faire connaissance » означает:", ["познакомиться", "попрощаться", "опоздать", "переехать"], 0, "faire connaissance", "faire connaissance = знакомиться."),
  mc(318, 7, "Lexique", "« prendre rendez-vous » означает:", ["записаться/назначить встречу", "отдыхать", "болеть", "готовить"], 0, "prendre rendez-vous", "prendre rendez-vous = назначить встречу."),
  tx(319, 9, "Lexique", "Переведите: « экономить энергию »", ["économiser l'énergie"], "économiser l'énergie", "économiser = экономить."),
];
