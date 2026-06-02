-- Seed: фразы A2 как набор (для Inworld-TTS + FSRS). Идемпотентно.

INSERT INTO sets (id, creator_id, title, description, is_public, fields_schema)
VALUES ('a2f00000-0000-4a2f-8a2f-000000000001', '11111111-1111-1111-1111-111111111111', 'Французский A2 — Фразы', 'Ходовые фразы A2 для реальных ситуаций (озвучка + повторение).', true, '[{"id":"term","name":"Phrase","type":"text","side":"front","order":1,"settings":{"language":"fr","ttsEnabled":true,"ttsVoice":"Alain"}},{"id":"definition","name":"Перевод","type":"text","side":"back","order":1,"settings":{"language":"ru"}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, is_public=EXCLUDED.is_public, fields_schema=EXCLUDED.fields_schema;

INSERT INTO flashcards (id, set_id, term, definition, order_index, fields_data) VALUES
('a2f0a2f0-0000-4a2f-8a2f-000000000001', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Enchanté(e) de faire votre connaissance.', 'Приятно познакомиться.', 1, '{"category":"Знакомство","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000002', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Comment ça s''écrit ?', 'Как это пишется?', 2, '{"category":"Знакомство","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000003', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Vous pouvez répéter, s''il vous plaît ?', 'Повторите, пожалуйста.', 3, '{"category":"Знакомство","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000004', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je vous en prie.', 'Пожалуйста / Не за что.', 4, '{"category":"Вежливость","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000005', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Excusez-moi de vous déranger.', 'Извините за беспокойство.', 5, '{"category":"Вежливость","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000006', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ce n''est pas grave.', 'Ничего страшного.', 6, '{"category":"Вежливость","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000007', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Est-ce que vous pourriez m''aider ?', 'Не могли бы вы мне помочь?', 7, '{"category":"Просьбы","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000008', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ça vous dérange si j''ouvre la fenêtre ?', 'Вы не против, если я открою окно?', 8, '{"category":"Просьбы","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000009', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ça te dit d''aller au cinéma ?', 'Не хочешь сходить в кино?', 9, '{"category":"Предложения","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000a', 'a2f00000-0000-4a2f-8a2f-000000000001', 'On pourrait se voir demain ?', 'Может, встретимся завтра?', 10, '{"category":"Предложения","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000b', 'a2f00000-0000-4a2f-8a2f-000000000001', 'À mon avis, ...', 'По-моему, ...', 11, '{"category":"Мнение","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000c', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je suis d''accord avec toi.', 'Я с тобой согласен.', 12, '{"category":"Мнение","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000d', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je ne suis pas du tout d''accord.', 'Я совершенно не согласен.', 13, '{"category":"Мнение","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000e', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je trouve que c''est une bonne idée.', 'Я считаю, это хорошая идея.', 14, '{"category":"Мнение","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000000f', 'a2f00000-0000-4a2f-8a2f-000000000001', 'J''ai hâte de te voir.', 'Жду не дождусь встречи с тобой.', 15, '{"category":"Чувства","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000010', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ça me fait plaisir.', 'Мне это приятно.', 16, '{"category":"Чувства","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000011', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je suis désolé(e), je ne peux pas.', 'Извини, я не могу.', 17, '{"category":"Чувства","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000012', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Combien ça coûte ?', 'Сколько это стоит?', 18, '{"category":"Покупки","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000013', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je voudrais essayer ce pull.', 'Я хотел бы примерить этот свитер.', 19, '{"category":"Покупки","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000014', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Vous payez comment ? — En carte.', 'Как вы платите? — Картой.', 20, '{"category":"Покупки","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000015', 'a2f00000-0000-4a2f-8a2f-000000000001', 'L''addition, s''il vous plaît.', 'Счёт, пожалуйста.', 21, '{"category":"Ресторан","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000016', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Qu''est-ce que vous me conseillez ?', 'Что вы посоветуете?', 22, '{"category":"Ресторан","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000017', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Pour aller à la gare, s''il vous plaît ?', 'Как пройти к вокзалу?', 23, '{"category":"Транспорт","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000018', 'a2f00000-0000-4a2f-8a2f-000000000001', 'À quelle heure part le prochain train ?', 'Во сколько следующий поезд?', 24, '{"category":"Транспорт","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000019', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je suis perdu(e).', 'Я заблудился.', 25, '{"category":"Транспорт","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001a', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je ne me sens pas bien.', 'Я плохо себя чувствую.', 26, '{"category":"Здоровье","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001b', 'a2f00000-0000-4a2f-8a2f-000000000001', 'J''ai pris rendez-vous chez le médecin.', 'Я записался к врачу.', 27, '{"category":"Здоровье","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001c', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ne quittez pas, je vous le passe.', 'Не вешайте трубку, я вас соединю.', 28, '{"category":"Связь","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001d', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je te rappelle plus tard.', 'Я перезвоню тебе позже.', 29, '{"category":"Связь","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001e', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Tu peux m''envoyer un message ?', 'Можешь прислать мне сообщение?', 30, '{"category":"Связь","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-00000000001f', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je suis libre ce week-end.', 'Я свободен в эти выходные.', 31, '{"category":"Планы","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000020', 'a2f00000-0000-4a2f-8a2f-000000000001', 'On se retrouve à quelle heure ?', 'Во сколько встречаемся?', 32, '{"category":"Планы","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000021', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Ça marche, à demain !', 'Договорились, до завтра!', 33, '{"category":"Планы","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000022', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Comment dit-on ... en français ?', 'Как сказать ... по-французски?', 34, '{"category":"В разговоре","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000023', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Je n''ai pas bien compris.', 'Я не совсем понял.', 35, '{"category":"В разговоре","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000024', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Qu''est-ce que ça veut dire ?', 'Что это значит?', 36, '{"category":"В разговоре","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000025', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Avec plaisir !', 'С удовольствием!', 37, '{"category":"Реакции","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000026', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Pourquoi pas !', 'Почему бы и нет!', 38, '{"category":"Реакции","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000027', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Malheureusement, je suis pris(e).', 'К сожалению, я занят.', 39, '{"category":"Реакции","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb),
('a2f0a2f0-0000-4a2f-8a2f-000000000028', 'a2f00000-0000-4a2f-8a2f-000000000001', 'Tant pis.', 'Ну и ладно / Тем хуже.', 40, '{"category":"Реакции","term_audio":"__AUDIO_ON_SERVER__"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET term=EXCLUDED.term, definition=EXCLUDED.definition, order_index=EXCLUDED.order_index, fields_data=EXCLUDED.fields_data;
