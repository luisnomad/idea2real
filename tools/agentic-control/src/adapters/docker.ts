import { runCommand } from "./exec.js";

export interface DockerCheck {
  installed: boolean;
  daemonUp: boolean;
}

export async function checkDocker(): Promise<DockerCheck> {
  const which = await runCommand("bash", ["-lc", "command -v docker >/dev/null 2>&1"], {
    reject: false,
  });

  if (which.exitCode !== 0) {
    return {
      installed: false,
      daemonUp: false,
    };
  }

  const info = await runCommand("docker", ["info"], { reject: false });

  return {
    installed: true,
    daemonUp: info.exitCode === 0,
  };
}
