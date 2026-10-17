# WaveRep attribution and restricted use

WaveRep is the GRIP-UNINA implementation of “Seeing What Matters:
Generalizable AI-generated Video Detection with Forensic-Oriented Augmentation”
(NeurIPS 2025), by Riccardo Corvi, Davide Cozzolino, Ekta Prashnani,
Shalini De Mello, Koki Nagano and Luisa Verdoliva.

Source: https://github.com/grip-unina/WaveRep-SyntheticVideoDetection
Pinned source revision: 0fd6010759c14b572b7842a28fa9f85fe1ddd2fd.
Official demo/checksum instructions: upstream/demo-README.md.
Full original license and notices: upstream/LICENSE.md.

The software may be reproduced, modified and used only for informational and
nonprofit purposes under the supplied license. Unauthorized industrial or
profit-oriented use is prohibited. Original notices must be retained and original
authors credited when publishing results. This is restricted research/demo code,
not unrestricted open source. This Shady integration is a noncommercial portfolio
demo. Do not deploy commercially without appropriate authorization.

The adapter in waverep.py follows the reviewed official demo/utils.py and
main_avideo.py. Copies of those files and their original license are preserved
under upstream/. No training datasets, G1 model, denoiser weights or additional
pretrained backbone are downloaded. The G4 checkpoint is loaded with strict tensor
matching and weights_only=True; its publisher MD5 is verified before loading.

Preprocessing: each decoded frame -> RGB PIL -> CenterCrop(504,504), padding
smaller frames as torchvision does -> ToTensor -> ImageNet mean/std normalization.
No resizing or temporal sampling. All frames are scored in bounded batches of 2,
matching the official evaluate_batch procedure. Logit/LLR > 0 is the published
synthetic-frame rule. Clip aggregation is the arithmetic mean of raw frame LLRs,
followed by sigmoid only as an explicitly uncalibrated transformed model score.
Actual presentation timestamps are normalized to the first decoded video frame.

Shady adds container validation, frame/timing limits, subprocess cancellation,
job orchestration, timeline display, privacy controls and tests. It does not
supply or train the WaveRep model.
