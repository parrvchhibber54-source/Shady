# Third-party notices

Shady combines independently licensed software and services. A public GitHub repository is not a blanket license for every included component.

| Component | Source / terms | Notices retained |
| --- | --- | --- |
| Fakespot model and recommended cleaning code | Apache License 2.0, pinned model revision in `text-service/service.py` | `text-service/LICENSE-Apache-2.0.txt`, `text-service/NOTICE.md`, reviewed model card |
| WaveRep demo and adapter | GRIP-UNINA informational/nonprofit license; unauthorized industrial/profit-oriented use prohibited | `video-service/upstream/LICENSE.md`, original upstream demo files, `video-service/NOTICE.md` |
| Cinzel font | SIL Open Font License | `public/fonts/OFL-Cinzel.txt` |
| npm / Python dependencies | Respective upstream licenses | Package metadata and pinned manifests |
| Sightengine / Reality Defender | External services under their own account/service terms | Attribution in interface and README |

Model weights are downloaded separately and are not distributed in this repository. Retain their upstream terms and attribution. WaveRep's adaptation keeps the publisher's architecture, preprocessing, per-frame rule and mean-LLR aggregation; Shady adds validation, jobs and interface logic.

Brand/collage artwork and the screen recording were supplied for this portfolio project. No separate permissive artwork license is granted here; obtain appropriate permission for reuse. The screenshot/demo scores illustrate particular inputs, not guaranteed detector performance. Do not represent the upstream models as having been authored or trained by Shady.

No blanket MIT/Apache license is applied to this mixed repository. Review the relevant component license and obtain permission for uses not covered by those terms.
