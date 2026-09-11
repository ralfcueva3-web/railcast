INSERT INTO trains(train_no,name,source_code,destination_code) VALUES
(13028,'Kaviguru Express','NHT','HWH') ON CONFLICT DO NOTHING;

INSERT INTO stations(code,name,distance_km,scheduled_arrival,scheduled_departure,platform) VALUES
('NHT','Nalhati Junction',45,'08:45','08:47',1),
('RPH','Rampur Hat',59,'09:10','09:12',3),
('SNT','Sainthia Junction',87,'09:34','09:35',4),
('AMP','Ahmadpur Junction',101,'09:47','09:48',2),
('BHP','Bolpur Shantiniketan',120,'10:05','10:07',2),
('BWN','Barddhaman Junction',171,'11:27','11:29',5),
('BDC','Bandel Junction',239,'12:40','12:42',3),
('HWH','Howrah Junction',278,'13:55','13:55',1)
ON CONFLICT(code) DO NOTHING;

INSERT INTO segments(station_from,station_to,distance_km) VALUES
('NHT','RPH',14),('RPH','SNT',28),('SNT','AMP',14),('AMP','BHP',19),
('BHP','BWN',51),('BWN','BDC',68),('BDC','HWH',39)
ON CONFLICT DO NOTHING;
