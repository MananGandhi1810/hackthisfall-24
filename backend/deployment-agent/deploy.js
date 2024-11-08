import { PrismaClient } from "@prisma/client";
import Dockerode from "dockerode";
import Docker from "dockerode";
import path from "path";

const docker = new Docker();
const dockerode = new Dockerode();
const prisma = new PrismaClient();

const ghRepoRegex =
    /https?:\/\/(www\.)?github.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)/;

const buildContainer = async ({ projectId, branchName, commitHash }) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            User: {
                select: {
                    ghAccessToken: true,
                },
            },
            envSecrets: true,
        },
    });
    const match = project.githubUrl.match(ghRepoRegex);
    if (!match || !(match.groups?.owner && match.groups?.name)) return null;
    const imageTag = `${match.groups.owner}/${match.groups.name}:latest`;
    const buildStream = await docker.buildImage(
        {
            context: path.join(
                process.cwd(),
                "dockerfiles",
                project.framework.toLowerCase(),
            ),
            src: ["Dockerfile"],
        },
        {
            buildargs: {
                repoUrl: `https://${project.User.ghAccessToken}@github.com/${match.groups.owner}/${match.groups.name}`,
                branch: branchName,
                commitHash: commitHash,
            },
            t: imageTag,
        },
    );
    await new Promise((resolve, reject) => {
        buildStream.on("data", (data) => {
            if (!data.toString().trim()) return;
            try {
                const buildOutput = JSON.parse(data.toString());
                if (buildOutput.stream) {
                    process.stdout.write(buildOutput.stream);
                } else if (buildOutput.error) {
                    console.error("Build Error:", buildOutput.error);
                    reject(buildOutput.error);
                }
            } catch (e) {}
        });
        buildStream.on("end", () => resolve());
    });
    console.log("Image Built succesfully");
    const envSecrets = project.envSecrets.map((v) => `${v.key}=${v.value}`);
    const container = await docker.createContainer({
        Image: imageTag,
        Tty: false,
        Env: envSecrets,
        HostConfig: {
            PortBindings: {
                "3000/tcp": [
                    {
                        HostPort: "0", //Map container to a random unused port.
                    },
                ],
            },
        },
    });
    container.start();
    container.attach(
        { stream: true, stdout: true, stderr: true },
        function (err, stream) {
            stream.pipe(process.stdout);
        },
    );
};

export { buildContainer };
